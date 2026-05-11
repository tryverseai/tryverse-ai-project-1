import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { requireAuth, convexProfileCreditLookupKey } from '../middleware/auth';
import { paymentRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { AppError } from '../middleware/errorHandler';
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
import { logger } from '../config/logger';
import { cxGetPlan, cxGetProfile } from '../services/creditsConvexBridge';
import type { PaystackWebhookEvent, FlutterwaveWebhookEvent } from '../types';

const router = Router();

function assertValidCallbackUrl(callbackUrl: string): void {
  try {
    const allowed = new URL(env.FRONTEND_URL);
    const given = new URL(callbackUrl);
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
}

/**
 * GET /api/payment/providers
 * Which payment rails are configured (no secrets exposed).
 */
router.get('/providers', (_req: Request, res: Response): void => {
  res.json({
    paystack: Boolean(env.PAYSTACK_SECRET_KEY),
    flutterwave: Boolean(env.FLUTTERWAVE_SECRET_KEY),
  });
});

/**
 * POST /api/payment/initialize/paystack
 * NGN — amount is taken from DB (plans.price_ngn), not the client.
 */
router.post(
  '/initialize/paystack',
  paymentRateLimit,
  requireAuth,
  [
    body('planId').isString().notEmpty().isLength({ max: 50 }).withMessage('planId is required'),
    body('callbackUrl')
      .isURL()
      .withMessage('callbackUrl must be a valid URL')
      .custom((url) => {
        assertValidCallbackUrl(url);
        return true;
      }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!env.PAYSTACK_SECRET_KEY) {
        res.status(503).json({ error: 'Paystack is not configured' });
        return;
      }
      const { planId, callbackUrl } = req.body;
      const plan = await cxGetPlan(planId);
      const p = plan as { price_ngn?: number; is_active?: boolean } | null;
      if (!p || !p.is_active || !p.price_ngn || p.price_ngn <= 0) {
        throw new AppError('Plan not available for Paystack checkout', 400);
      }

      const result = await initializePaystackPayment({
        email: req.user!.email,
        amount: p.price_ngn,
        planId,
        userId: req.user!.id,
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
 * Amount from DB: USD → price_usd, NGN → price_ngn (other currencies not server-priced).
 */
router.post(
  '/initialize/flutterwave',
  paymentRateLimit,
  requireAuth,
  [
    body('planId').isString().notEmpty().isLength({ max: 50 }).withMessage('planId is required'),
    body('currency')
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage('currency must be 3-letter code')
      .custom((c) => {
        if (!['USD', 'NGN'].includes(String(c).toUpperCase())) {
          throw new Error('Use USD or NGN for Flutterwave (amounts are taken from your plan)');
        }
        return true;
      }),
    body('callbackUrl')
      .isURL()
      .withMessage('callbackUrl must be a valid URL')
      .custom((url) => {
        assertValidCallbackUrl(url);
        return true;
      }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!env.FLUTTERWAVE_SECRET_KEY) {
        res.status(503).json({ error: 'Flutterwave is not configured' });
        return;
      }
      const { planId, currency, callbackUrl } = req.body;
      const cur = String(currency).toUpperCase();

      const plan = await cxGetPlan(planId);
      const p = plan as { price_usd?: number; price_ngn?: number; is_active?: boolean } | null;
      if (!p || !p.is_active) {
        throw new AppError('Plan not found or inactive', 404);
      }

      const amount = cur === 'USD' ? p.price_usd : p.price_ngn;
      if (amount === undefined || amount <= 0) {
        throw new AppError('This plan is not available for self-checkout in this currency', 400);
      }

      const profile = await cxGetProfile(convexProfileCreditLookupKey(req));

      const result = await initializeFlutterwavePayment({
        email: req.user!.email,
        amount,
        currency: cur,
        planId,
        userId: req.user!.id,
        callbackUrl,
        fullName: (profile as { full_name?: string } | null)?.full_name || undefined,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/payment/webhook/paystack
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

      let event: PaystackWebhookEvent;
      try {
        event = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as PaystackWebhookEvent;
      } catch {
        res.status(400).json({ error: 'Invalid webhook payload' });
        return;
      }
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

      let event: FlutterwaveWebhookEvent;
      try {
        event = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as FlutterwaveWebhookEvent;
      } catch {
        res.status(400).json({ error: 'Invalid webhook payload' });
        return;
      }
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
 */
router.get(
  '/verify/paystack/:reference',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!env.PAYSTACK_SECRET_KEY) {
        res.status(503).json({ error: 'Paystack is not configured' });
        return;
      }
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
 */
router.get(
  '/verify/flutterwave/:transactionId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!env.FLUTTERWAVE_SECRET_KEY) {
        res.status(503).json({ error: 'Flutterwave is not configured' });
        return;
      }
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
