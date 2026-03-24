import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { earlyAccessRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { supabaseAdmin } from '../config/supabase';
import { sendEmail } from '../services/email/resend';
import { logger } from '../config/logger';
import { buildEarlyAccessConfirmationHtml } from './earlyAccessEmailHtml';

const router = Router();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

router.post(
  '/',
  earlyAccessRateLimit,
  [
    body('first_name').trim().isLength({ min: 1, max: 120 }),
    body('email').trim().isEmail().isLength({ max: 254 }),
    body('brand_name').trim().isLength({ min: 1, max: 200 }),
    body('role').trim().isLength({ min: 1, max: 300 }),
    body('website_url').trim().isLength({ min: 1, max: 2000 }),
    body('platform').trim().isLength({ min: 1, max: 120 }),
    body('product_range').trim().isLength({ min: 1, max: 80 }),
    body('monthly_revenue').trim().isLength({ min: 1, max: 80 }),
    body('return_rate').trim().isLength({ min: 1, max: 80 }),
    body('top_return_reason').trim().isLength({ min: 1, max: 80 }),
    body('customer_confidence').trim().isLength({ min: 1, max: 80 }),
    body('tried_solutions')
      .isArray({ min: 1 })
      .custom((arr: unknown) =>
        Array.isArray(arr) && arr.every((x) => typeof x === 'string' && x.length <= 120)
      ),
    body('must_have_features')
      .isArray({ min: 1 })
      .custom((arr: unknown) =>
        Array.isArray(arr) && arr.every((x) => typeof x === 'string' && x.length <= 120)
      ),
    body('biggest_challenge').trim().isLength({ min: 1, max: 8000 }),
    body('timeline').trim().isLength({ min: 1, max: 80 }),
    body('heard_about').optional({ nullable: true }).isString().isLength({ max: 120 }),
    body('prior_solution_notes').optional({ nullable: true }).isString().isLength({ max: 8000 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        first_name,
        email,
        brand_name,
        role,
        website_url,
        platform,
        product_range,
        monthly_revenue,
        return_rate,
        top_return_reason,
        customer_confidence,
        tried_solutions,
        must_have_features,
        biggest_challenge,
        timeline,
        heard_about,
        prior_solution_notes,
      } = req.body as Record<string, unknown>;

      const { data, error } = await supabaseAdmin
        .from('early_access_requests')
        .insert({
          first_name,
          email: String(email).toLowerCase(),
          brand_name,
          role,
          website_url,
          platform,
          product_range,
          monthly_revenue,
          return_rate,
          top_return_reason,
          customer_confidence,
          tried_solutions,
          must_have_features,
          biggest_challenge,
          timeline,
          heard_about: heard_about || null,
          prior_solution_notes: prior_solution_notes || null,
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Early access insert failed', { error: error.message });
        res.status(500).json({ error: 'Could not save your application. Please try again later.' });
        return;
      }

      const to = String(email).toLowerCase();

      // HTML email: arguments are escapeHtml() output; body is assembled in earlyAccessEmailHtml.ts
      // nosemgrep: javascript.lang.security.audit.raw-html-format
      const html = buildEarlyAccessConfirmationHtml(
        escapeHtml(String(first_name)),
        escapeHtml(String(brand_name))
      );

      const text = `Hi ${String(first_name)},\n\nThanks for requesting early access to TryVerse for ${String(brand_name)}.\n\nWe've received your details and will follow up to learn more about your store and how we can support your goals.\n\n— The TryVerse team`;

      const emailSent = await sendEmail({
        to,
        subject: 'We received your TryVerse early access request',
        html,
        text,
      });

      if (!emailSent) {
        logger.warn('Early access saved but confirmation email was not sent', {
          id: data?.id,
          to,
          hint:
            'Set RESEND_API_KEY in backend/.env. For Resend test mode, emails only go to your verified address; for production verify your domain at resend.com/domains and set EMAIL_FROM to an address on that domain.',
        });
      }

      res.status(201).json({ success: true, id: data?.id, emailSent });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
