import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { supportContactRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { env } from '../config/env';
import { anyApi, convexMutationTrusted } from '../config/convexHttp';
import { logger } from '../config/logger';

const router = Router();

/**
 * POST /api/support/contact
 * Inserts into public.support_requests via service role (avoids client PostgREST / schema cache issues).
 */
router.post(
  '/contact',
  supportContactRateLimit,
  [
    body('first_name').trim().isLength({ min: 1, max: 120 }),
    body('last_name').trim().isLength({ min: 1, max: 120 }),
    body('company_name').optional({ nullable: true }).isString().isLength({ max: 200 }),
    body('email').trim().isEmail().isLength({ max: 254 }),
    body('phone_number').optional({ nullable: true }).isString().isLength({ max: 40 }),
    body('category').trim().isLength({ min: 1, max: 80 }),
    body('subject').trim().isLength({ min: 1, max: 200 }),
    body('message').trim().isLength({ min: 1, max: 12000 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const first_name = String(req.body.first_name).trim();
      const last_name = String(req.body.last_name).trim();
      const company_name = req.body.company_name ? String(req.body.company_name).trim() : null;
      const email = String(req.body.email).trim().toLowerCase();
      const phone_number = req.body.phone_number ? String(req.body.phone_number).trim() : null;
      const category = String(req.body.category).trim();
      const subject = String(req.body.subject).trim();
      const message = String(req.body.message).trim();
      const name = `${first_name} ${last_name}`.trim();

      try {
        await convexMutationTrusted(anyApi.backendTrusted.insertSupportRequestTrusted, {
          secret: env.BACKEND_SHARED_SECRET,
          name,
          first_name,
          last_name,
          company_name: company_name || null,
          email,
          phone_number: phone_number || null,
          category,
          subject,
          message,
        });
      } catch (error) {
        logger.error('support_requests insert failed', { message: String(error) });
        res.status(500).json({
          error: 'Could not save your message. Please try again or email us directly.',
          details:
            process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
        });
        return;
      }

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
