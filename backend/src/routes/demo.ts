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

const ENTERPRISE_FEATURE_OPTIONS = [
  'Virtual Try-On',
  'Outfit Visualization',
  'AI Model Generation',
  'AI Photoshoot',
  'AI Video',
  'API / SDK integration',
  'Analytics',
  'Custom infrastructure / SLA',
] as const;

/**
 * POST /api/demo/enterprise
 * Enterprise "Let's Talk" — a dedicated contact flow distinct from the generic Book a Demo form,
 * for prospects evaluating TryVerse as fashion-visualization infrastructure at scale. Reuses the
 * same support_requests storage/delivery path as /book, under its own `category` value.
 */
router.post(
  '/enterprise',
  supportContactRateLimit,
  [
    body('full_name').trim().isLength({ min: 1, max: 200 }),
    body('email').trim().isEmail().isLength({ max: 254 }),
    body('company_name').trim().isLength({ min: 1, max: 200 }),
    body('company_website').optional({ nullable: true }).trim().isLength({ max: 300 }),
    body('role').optional({ nullable: true }).trim().isLength({ max: 200 }),
    body('country').optional({ nullable: true }).trim().isLength({ max: 200 }),
    body('catalogue_size').optional({ nullable: true }).trim().isLength({ max: 200 }),
    body('monthly_generation_volume').optional({ nullable: true }).trim().isLength({ max: 200 }),
    body('features_interested').optional({ nullable: true }).isArray({ max: ENTERPRISE_FEATURE_OPTIONS.length }),
    body('features_interested.*').optional().isIn([...ENTERPRISE_FEATURE_OPTIONS]),
    body('api_sdk_requirements').optional({ nullable: true }).trim().isLength({ max: 4000 }),
    body('infrastructure_requirements').optional({ nullable: true }).trim().isLength({ max: 4000 }),
    body('message').optional({ nullable: true }).isString().isLength({ max: 8000 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fullName = String(req.body.full_name).trim();
      const email = String(req.body.email).trim().toLowerCase();
      const companyName = String(req.body.company_name).trim();
      const companyWebsite = req.body.company_website ? String(req.body.company_website).trim() : '';
      const role = req.body.role ? String(req.body.role).trim() : '';
      const country = req.body.country ? String(req.body.country).trim() : '';
      const catalogueSize = req.body.catalogue_size ? String(req.body.catalogue_size).trim() : '';
      const monthlyVolume = req.body.monthly_generation_volume
        ? String(req.body.monthly_generation_volume).trim()
        : '';
      const featuresInterested: string[] = Array.isArray(req.body.features_interested)
        ? req.body.features_interested.map((f: unknown) => String(f))
        : [];
      const apiSdkRequirements = req.body.api_sdk_requirements ? String(req.body.api_sdk_requirements).trim() : '';
      const infrastructureRequirements = req.body.infrastructure_requirements
        ? String(req.body.infrastructure_requirements).trim()
        : '';
      const message = req.body.message ? String(req.body.message).trim() : '';

      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] ?? fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-';

      const subject = `Enterprise inquiry — ${companyName}`;
      const detailBlock = [
        `Company: ${companyName}`,
        companyWebsite ? `Website: ${companyWebsite}` : '',
        role ? `Role: ${role}` : '',
        country ? `Country: ${country}` : '',
        catalogueSize ? `Estimated catalogue size: ${catalogueSize}` : '',
        monthlyVolume ? `Monthly expected generation volume: ${monthlyVolume}` : '',
        featuresInterested.length ? `Features interested in: ${featuresInterested.join(', ')}` : '',
        apiSdkRequirements ? `API/SDK integration requirements: ${apiSdkRequirements}` : '',
        infrastructureRequirements ? `Infrastructure requirements: ${infrastructureRequirements}` : '',
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
          company_name: companyName,
          email,
          phone_number: null,
          category: 'enterprise_inquiry',
          subject,
          message: detailBlock,
        });
      } catch (error) {
        logger.error('enterprise inquiry insert failed', { message: String(error) });
        res.status(500).json({ error: 'Could not save your request. Please try again or email sales@tryverseai.com.' });
        return;
      }

      const confirmationHtml = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:520px">
  <h1 style="font-size:22px">Thank you for reaching out</h1>
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Thank you for your interest in TryVerse's enterprise AI infrastructure for fashion visualization.
  A member of our team will follow up within one business day to discuss your requirements.</p>
  <p style="font-size:14px;color:#555">— The TryVerse Team<br/><a href="https://tryverseai.com">tryverseai.com</a></p>
</body></html>`;

      const adminHtml = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.6;color:#111;max-width:560px">
  <h1 style="font-size:20px">New Enterprise inquiry</h1>
  <p><strong>Name:</strong> ${escapeHtml(fullName)}</p>
  <p><strong>Email:</strong> ${escapeHtml(email)}</p>
  <p><strong>Company:</strong> ${escapeHtml(companyName)}</p>
  ${companyWebsite ? `<p><strong>Website:</strong> ${escapeHtml(companyWebsite)}</p>` : ''}
  ${role ? `<p><strong>Role:</strong> ${escapeHtml(role)}</p>` : ''}
  ${country ? `<p><strong>Country:</strong> ${escapeHtml(country)}</p>` : ''}
  ${catalogueSize ? `<p><strong>Estimated catalogue size:</strong> ${escapeHtml(catalogueSize)}</p>` : ''}
  ${monthlyVolume ? `<p><strong>Monthly expected generation volume:</strong> ${escapeHtml(monthlyVolume)}</p>` : ''}
  ${featuresInterested.length ? `<p><strong>Features interested in:</strong> ${escapeHtml(featuresInterested.join(', '))}</p>` : ''}
  ${apiSdkRequirements ? `<p><strong>API/SDK requirements:</strong><br/>${escapeHtml(apiSdkRequirements)}</p>` : ''}
  ${infrastructureRequirements ? `<p><strong>Infrastructure requirements:</strong><br/>${escapeHtml(infrastructureRequirements)}</p>` : ''}
  ${message ? `<p><strong>Message:</strong><br/>${escapeHtml(message)}</p>` : ''}
</body></html>`;

      await Promise.allSettled([
        sendEmail({
          to: email,
          subject: 'Your TryVerse Enterprise inquiry — we\'ll be in touch',
          html: confirmationHtml,
          from: TRYVERSE_TRANSACTIONAL_FROM,
        }),
        sendEmail({
          to: adminNotificationEmail(),
          subject: `[TryVerse] New Enterprise inquiry — ${companyName}`,
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
