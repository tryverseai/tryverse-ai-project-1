import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { paymentRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { env } from '../config/env';
import {
  initializePaystackPayment,
  validatePaystackSignature,
  handlePaystackWebhook,
  verifyPaystackTransaction,
} from '../services/payments/paystack';
import {
  initializeFlutterwavePayment,
  validateFlutterwaveSignature,
  handleFlutterwaveWebhook,
  verifyFlutterwaveTransaction,
} from '../services/payments/flutterwave';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import type { PaystackWebhookEvent, FlutterwaveWebhookEvent } from '../types';

const router = Router();

/**
 * POST /api/payment/initialize/paystack
 * Initializes a Paystack checkout for a plan subscription.
 */
router.post(
  '/initialize/paystack',
  paymentRateLimit,
  requireAuth,
  [
    body('planId').isString().notEmpty().isLength({ max: 50 }).withMessage('planId is required'),
    body('amount').isNumeric().withMessage('amount must be a number'),
    body('callbackUrl')
      .isURL()
      .withMessage('callbackUrl must be a valid URL')
      .custom((url) => {
        try {
          const allowed = new URL(env.FRONTEND_URL);
          const given = new URL(url);
          if (allowed.hostname !== given.hostname) {
            throw new Error('callbackUrl host must match FRONTEND_URL');
          }
          // In production, require same origin; in dev allow localhost on any port
          if (env.NODE_ENV === 'production' && allowed.origin !== given.origin) {
            throw new Error('callbackUrl must match application origin in production');
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('callbackUrl')) throw e;
          throw new Error('Invalid callbackUrl');
        }
        return true;
      }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { planId, amount, callbackUrl } = req.body;
      const userId = req.user!.id;
      const email = req.user!.email;

      const result = await initializePaystackPayment({
        email,
        amount,
        planId,
        userId,
        callbackUrl,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/payment/initialize/flutterwave
 * Initializes a Flutterwave checkout.
 */
router.post(
  '/initialize/flutterwave',
  paymentRateLimit,
  requireAuth,
  [
    body('planId').isString().notEmpty().isLength({ max: 50 }).withMessage('planId is required'),
    body('amount').isNumeric().withMessage('amount must be a number'),
    body('currency').isString().isLength({ min: 3, max: 3 }).withMessage('currency must be 3-letter code'),
    body('callbackUrl')
      .isURL()
      .withMessage('callbackUrl must be a valid URL')
      .custom((url) => {
        try {
          const allowed = new URL(env.FRONTEND_URL);
          const given = new URL(url);
          if (allowed.hostname !== given.hostname) {
            throw new Error('callbackUrl host must match FRONTEND_URL');
          }
          if (env.NODE_ENV === 'production' && allowed.origin !== given.origin) {
            throw new Error('callbackUrl must match application origin in production');
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('callbackUrl')) throw e;
          throw new Error('Invalid callbackUrl');
        }
        return true;
      }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { planId, amount, currency, callbackUrl } = req.body;
      const userId = req.user!.id;
      const email = req.user!.email;

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      const result = await initializeFlutterwavePayment({
        email,
        amount,
        currency,
        planId,
        userId,
        callbackUrl,
        fullName: profile?.full_name || undefined,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/payment/webhook/paystack
 * Receives and verifies Paystack webhook events.
 * Uses express.text (raw string) for HMAC verification — mounted in server.ts.
 */
router.post(
  '/webhook/paystack',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sig = req.headers['x-paystack-signature'];
      const signature = Array.isArray(sig) ? sig[0] : sig || '';
      const rawBody = typeof req.body === 'string' ? req.body : '';

      if (!signature || !rawBody || !validatePaystackSignature(rawBody, signature)) {
        logger.warn('Invalid Paystack webhook signature');
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }

      const event = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as PaystackWebhookEvent;
      // Respond immediately to Paystack, process async
      res.status(200).json({ received: true });

      handlePaystackWebhook(event).catch((err) => {
        logger.error('Paystack webhook processing error', { error: String(err) });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/payment/webhook/flutterwave
 * Receives and verifies Flutterwave webhook events.
 */
router.post(
  '/webhook/flutterwave',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vh = req.headers['verif-hash'];
      const verifHash = Array.isArray(vh) ? vh[0] : vh || '';
      const rawBody = typeof req.body === 'string' ? req.body : '';

      if (!validateFlutterwaveSignature(rawBody, verifHash)) {
        logger.warn('Invalid Flutterwave webhook signature');
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }

      const event = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as FlutterwaveWebhookEvent;
      res.status(200).json({ received: true });

      handleFlutterwaveWebhook(event).catch((err) => {
        logger.error('Flutterwave webhook processing error', { error: String(err) });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/payment/verify/paystack/:reference
 * Manually verify a Paystack transaction (called after redirect).
 * Verifies the payment belongs to the authenticated user (IDOR prevention).
 */
router.get(
  '/verify/paystack/:reference',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reference = String(req.params.reference || '').trim();
      if (!reference) {
        res.status(400).json({ error: 'Reference required' });
        return;
      }
      const result = await verifyPaystackTransaction(reference);
      if (result.metadata?.user_id !== req.user!.id) {
        logger.warn('Payment verify: user mismatch', {
          reference,
          expectedUser: req.user!.id,
          paymentUser: result.metadata?.user_id,
        });
        res.status(403).json({ error: 'This payment does not belong to your account' });
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/payment/verify/flutterwave/:transactionId
 * Manually verify a Flutterwave transaction.
 * Verifies the payment belongs to the authenticated user (IDOR prevention).
 */
router.get(
  '/verify/flutterwave/:transactionId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const transactionId = String(req.params.transactionId || '').trim();
      if (!transactionId) {
        res.status(400).json({ error: 'Transaction ID required' });
        return;
      }
      const result = await verifyFlutterwaveTransaction(transactionId);
      if (result.meta?.user_id !== req.user!.id) {
        logger.warn('Payment verify: user mismatch', {
          transactionId,
          expectedUser: req.user!.id,
          paymentUser: result.meta?.user_id,
        });
        res.status(403).json({ error: 'This payment does not belong to your account' });
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
