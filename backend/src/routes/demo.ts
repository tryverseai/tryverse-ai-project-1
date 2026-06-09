import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { supportContactRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { env } from '../config/env';
import { anyApi, convexMutationTrusted } from '../config/convexHttp';
import { sendEmail } from '../services/email/resend';
import { TRYVERSE_TRANSACTIONAL_FROM } from '../email/fromAddress';
import { logger } from '../config/logger';

const router = Router();

const PLATFORM_OPTIONS = ['Shopify', 'WooCommerce', 'Wix', 'Squarespace', 'Other'] as const;
const VISITOR_OPTIONS = ['Under 10k', '10k-50k', '50k-100k', '100k+'] as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function adminNotificationEmail(): string {
  return (process.env.DEMO_NOTIFICATION_EMAIL ?? 'info@tryverseai.com').trim();
}

/**
 * POST /api/demo/book
 * Book a Demo form — stores request and sends confirmation + admin notification.
 */
router.post(
  '/book',
  supportContactRateLimit,
  [
    body('full_name').trim().isLength({ min: 1, max: 200 }),
    body('email').trim().isEmail().isLength({ max: 254 }),
    body('brand_name').trim().isLength({ min: 1, max: 200 }),
    body('store_platform')
      .trim()
      .isIn([...PLATFORM_OPTIONS]),
    body('monthly_visitors')
      .trim()
      .isIn([...VISITOR_OPTIONS]),
    body('message').optional({ nullable: true }).isString().isLength({ max: 8000 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fullName = String(req.body.full_name).trim();
      const email = String(req.body.email).trim().toLowerCase();
      const brandName = String(req.body.brand_name).trim();
      const storePlatform = String(req.body.store_platform).trim();
      const monthlyVisitors = String(req.body.monthly_visitors).trim();
      const message = req.body.message ? String(req.body.message).trim() : '';

      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] ?? fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-';

      const subject = `Demo request — ${brandName}`;
      const detailBlock = [
        `Brand: ${brandName}`,
        `Platform: ${storePlatform}`,
        `Monthly visitors: ${monthlyVisitors}`,
        message ? `Message: ${message}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      try {
        await convexMutationTrusted(anyApi.backendTrusted.insertSupportRequestTrusted, {
          secret: env.BACKEND_SHARED_SECRET,
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          company_name: brandName,
          email,
          phone_number: null,
          category: 'demo_booking',
          subject,
          message: detailBlock,
        });
      } catch (error) {
        logger.error('demo booking insert failed', { message: String(error) });
        res.status(500).json({ error: 'Could not save your request. Please try again or email info@tryverseai.com.' });
        return;
      }

      const confirmationHtml = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:520px">
  <h1 style="font-size:22px">Thank you for booking a demo</h1>
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Thank you! A member of the TryVerse team will reach out within 24 hours to schedule your private walkthrough.</p>
  <p style="font-size:14px;color:#555">— The TryVerse Team<br/><a href="https://tryverseai.com">tryverseai.com</a></p>
</body></html>`;

      const adminHtml = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px">
  <h1 style="font-size:20px">New demo booking</h1>
  <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
  <p><strong>Email:</strong> ${escapeHtml(email)}</p>
  <p><strong>Brand:</strong> ${escapeHtml(brandName)}</p>
  <p><strong>Platform:</strong> ${escapeHtml(storePlatform)}</p>
  <p><strong>Monthly visitors:</strong> ${escapeHtml(monthlyVisitors)}</p>
  ${message ? `<p><strong>Message:</strong><br/>${escapeHtml(message)}</p>` : ''}
</body></html>`;

      await Promise.allSettled([
        sendEmail({
          to: email,
          subject: 'Your TryVerse demo request — we\'ll be in touch',
          html: confirmationHtml,
          from: TRYVERSE_TRANSACTIONAL_FROM,
        }),
        sendEmail({
          to: adminNotificationEmail(),
          subject: `[TryVerse] New demo booking — ${brandName}`,
          html: adminHtml,
          from: TRYVERSE_TRANSACTIONAL_FROM,
        }),
      ]);

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
