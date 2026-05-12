import { Router, Request, Response } from 'express';
import { body } from 'express-validator';
import { requireAuth, convexProfileCreditLookupKey } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { sendWelcomeEmail, sendApiKeyDeliveryEmail } from '../services/email';
import { cxGetProfile } from '../services/creditsConvexBridge';

const router = Router();

/**
 * POST /api/emails/welcome
 * Sends welcome email to the **authenticated user's** email only (no arbitrary recipient).
 */
router.post(
  '/welcome',
  requireAuth,
  [
    body('name').optional().isString().isLength({ max: 200 }),
    body('brandName').optional().isString().isLength({ max: 200 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const email = req.user!.email;
      if (!email) {
        res.status(400).json({ error: 'Account has no email address' });
        return;
      }
      const profileKey = convexProfileCreditLookupKey(req);
      const profile = await cxGetProfile(profileKey);
      const welcomeIso =
        typeof profile?.welcome_email_sent_at === 'string' ? profile.welcome_email_sent_at.trim() : '';
      const legacyIso =
        typeof profile?.verification_email_sent_at === 'string'
          ? profile.verification_email_sent_at.trim()
          : '';
      if (welcomeIso.length > 0 || legacyIso.length > 0) {
        res.status(204).end();
        return;
      }
      const { name, brandName } = req.body;
      await sendWelcomeEmail({ email, name, brandName });
      res.status(202).json({ success: true });
    } catch {
      res.status(202).json({ success: true }); // Always 202 to avoid blocking signup
    }
  }
);

/**
 * POST /api/emails/api-key-delivery
 * Sends API key delivery email. Call from frontend after creating an API key.
 */
router.post(
  '/api-key-delivery',
  requireAuth,
  [
    body('keyName').isString().trim().notEmpty().isLength({ max: 100 }),
    body('keyPreview').isString().isLength({ min: 1, max: 50 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const email = req.user!.email;
      if (!email) {
        res.status(400).json({ error: 'User email not found' });
        return;
      }

      const { keyName, keyPreview } = req.body;
      await sendApiKeyDeliveryEmail({
        email,
        keyName,
        keyPreview,
      });
      res.status(202).json({ success: true });
    } catch {
      res.status(202).json({ success: true }); // Don't block API key creation
    }
  }
);

export default router;
