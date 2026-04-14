import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { earlyAccessRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { env } from '../config/env';
import { anyApi, convexMutationTrusted } from '../config/convexHttp';
import { sendEmail } from '../services/email/resend';
import { logger } from '../config/logger';
import { buildEarlyAccessConfirmationHtml, buildIndividualWaitlistConfirmationHtml } from './earlyAccessEmailHtml';

const router = Router();

/** Placeholders for required merchant columns when saving an individual waitlist row. */
const INDIVIDUAL_EARLY_ACCESS_FILLERS = {
  brand_name_suffix: '(personal interest)',
  role: 'Individual waitlist',
  website_url: 'https://tryverseai.com',
  platform: 'Personal',
  product_range: 'n/a',
  monthly_revenue: 'n/a',
  return_rate: 'n/a',
  top_return_reason: 'n/a',
  customer_confidence: 'n/a',
} as const;

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

      try {
        await convexMutationTrusted(anyApi.backendTrusted.insertEarlyAccessRowTrusted, {
          secret: env.BACKEND_SHARED_SECRET,
          row: {
            applicant_type: 'business',
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
          },
        });
      } catch (error) {
        logger.error('Early access insert failed', { error: String(error) });
        res.status(500).json({ error: 'Could not save your application. Please try again later.' });
        return;
      }

      const to = String(email).toLowerCase();

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
          to,
          hint:
            'Set RESEND_API_KEY in backend/.env. For Resend test mode, emails only go to your verified address; for production verify your domain at resend.com/domains and set EMAIL_FROM to an address on that domain.',
        });
      }

      res.status(201).json({ success: true, emailSent });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/individual',
  earlyAccessRateLimit,
  [
    body('first_name').trim().isLength({ min: 1, max: 120 }),
    body('email').trim().isEmail().isLength({ max: 254 }),
    body('what_interests_you').trim().isLength({ min: 1, max: 8000 }),
    body('timeline').trim().isLength({ min: 1, max: 80 }),
    body('heard_about').optional({ nullable: true }).isString().isLength({ max: 120 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { first_name, email, what_interests_you, timeline, heard_about } = req.body as Record<
        string,
        unknown
      >;

      try {
        await convexMutationTrusted(anyApi.backendTrusted.insertEarlyAccessRowTrusted, {
          secret: env.BACKEND_SHARED_SECRET,
          row: {
            applicant_type: 'individual',
            first_name,
            email: String(email).toLowerCase(),
            brand_name: `${String(first_name).trim()} ${INDIVIDUAL_EARLY_ACCESS_FILLERS.brand_name_suffix}`,
            role: INDIVIDUAL_EARLY_ACCESS_FILLERS.role,
            website_url: INDIVIDUAL_EARLY_ACCESS_FILLERS.website_url,
            platform: INDIVIDUAL_EARLY_ACCESS_FILLERS.platform,
            product_range: INDIVIDUAL_EARLY_ACCESS_FILLERS.product_range,
            monthly_revenue: INDIVIDUAL_EARLY_ACCESS_FILLERS.monthly_revenue,
            return_rate: INDIVIDUAL_EARLY_ACCESS_FILLERS.return_rate,
            top_return_reason: INDIVIDUAL_EARLY_ACCESS_FILLERS.top_return_reason,
            customer_confidence: INDIVIDUAL_EARLY_ACCESS_FILLERS.customer_confidence,
            tried_solutions: [],
            must_have_features: [],
            biggest_challenge: what_interests_you,
            timeline,
            heard_about: heard_about || null,
            prior_solution_notes: null,
          },
        });
      } catch (error) {
        logger.error('Individual early access insert failed', { error: String(error) });
        res.status(500).json({ error: 'Could not save your request. Please try again later.' });
        return;
      }

      const to = String(email).toLowerCase();
      const html = buildIndividualWaitlistConfirmationHtml(escapeHtml(String(first_name)));
      const text = `Hi ${String(first_name)},\n\nThanks for your interest in TryVerse for personal virtual try-on.\n\nWe've received your details and will be in touch.\n\n— The TryVerse team`;

      const emailSent = await sendEmail({
        to,
        subject: 'We received your TryVerse interest',
        html,
        text,
      });

      if (!emailSent) {
        logger.warn('Individual early access saved but confirmation email was not sent', {
          to,
        });
      }

      res.status(201).json({ success: true, emailSent });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
