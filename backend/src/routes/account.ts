import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, convexProfileCreditLookupKey } from '../middleware/auth';
import { cxGetProfile, cxInsertProfile, cxPatchProfile } from '../services/creditsConvexBridge';
import { DEFAULT_FREE_CREDITS_BUSINESS, DEFAULT_FREE_CREDITS_INDIVIDUAL } from '../services/credits';
import { logger } from '../config/logger';
import { verifyTurnstileToken } from '../services/turnstile';
import { sendAccountVerifiedEmail } from '../services/email';
import { cxConsolidateTryonsToCanonicalUserId } from '../services/tryonConvexBridge';

const router = Router();

async function sendAccountVerifiedEmailOnce(params: {
  profileKey: string;
  email: string;
  fullName?: string;
  brandName?: string;
  logUserSlice: string;
}): Promise<void> {
  const { profileKey, email, fullName, brandName, logUserSlice } = params;
  const row = await cxGetProfile(profileKey);
  if (!row || !email.trim()) return;
  if (typeof row.verification_email_sent_at === 'string' && row.verification_email_sent_at) {
    return;
  }
  const firstToken =
    fullName?.trim()?.split(/\s+/)[0] ?? brandName?.trim()?.split(/\s+/)[0];
  try {
    const ok = await sendAccountVerifiedEmail({
      email,
      ...(firstToken ? { firstName: firstToken } : {}),
    });
    if (ok) {
      await cxPatchProfile(profileKey, {
        verification_email_sent_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    logger.warn('account verified email skipped or failed', {
      error: String(e),
      userId: logUserSlice,
    });
  }
}

/**
 * POST /api/account/session/bootstrap
 * Ensures a Convex `profiles` row exists for the authenticated local-session user.
 */
router.post(
  '/session/bootstrap',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const canonicalId = req.user!.id;
      const profileKey = convexProfileCreditLookupKey(req);
      const body = req.body as Record<string, unknown>;
      const emailFromJwt = (req.user!.email || '').trim();
      const emailFromBody =
        typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const email = emailFromJwt || emailFromBody;
      const turnstileToken =
        typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined;
      const ip = typeof req.ip === 'string' ? req.ip : undefined;
      if (!(await verifyTurnstileToken(turnstileToken, ip))) {
        res.status(403).json({ error: 'Security verification failed. Please try again.' });
        return;
      }

      try {
        await cxConsolidateTryonsToCanonicalUserId(req.convexAuthSubjectRaw ?? canonicalId);
      } catch (e) {
        logger.warn('try-on subject consolidation skipped or failed during bootstrap', {
          error: String(e),
          userSlice: canonicalId.slice(0, 12),
        });
      }

      const accountTypeRaw = body.accountType;
      const at = accountTypeRaw === 'individual' ? 'individual' : 'business';
      const cap = at === 'individual' ? DEFAULT_FREE_CREDITS_INDIVIDUAL : DEFAULT_FREE_CREDITS_BUSINESS;
      const brandName = typeof body.brandName === 'string' ? body.brandName : undefined;
      const fullName = typeof body.fullName === 'string' ? body.fullName : undefined;
      const role = typeof body.role === 'string' ? body.role : undefined;

      const existing = await cxGetProfile(profileKey);
      if (existing) {
        await cxPatchProfile(profileKey, {
          contact_email: email || existing.contact_email,
          ...(brandName !== undefined ? { brand_name: brandName } : {}),
          ...(fullName !== undefined ? { full_name: fullName } : {}),
          ...(role !== undefined ? { role } : {}),
          account_type: at,
        });
        await sendAccountVerifiedEmailOnce({
          profileKey,
          email,
          fullName,
          brandName,
          logUserSlice: canonicalId.slice(0, 12),
        });
        res.json({ ok: true, created: false });
        return;
      }

      await cxInsertProfile(canonicalId, at, cap, cap, {
        ...(email ? { contactEmail: email } : {}),
      });
      await cxPatchProfile(profileKey, {
        ...(brandName !== undefined ? { brand_name: brandName } : {}),
        ...(fullName !== undefined ? { full_name: fullName } : {}),
        ...(role !== undefined ? { role } : {}),
      });

      await sendAccountVerifiedEmailOnce({
        profileKey,
        email,
        fullName,
        brandName,
        logUserSlice: canonicalId.slice(0, 12),
      });
      res.json({ ok: true, created: true });
    } catch (err) {
      logger.error('account bootstrap failed', { error: String(err) });
      next(err);
    }
  }
);

/**
 * GET /api/account/me
 */
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await cxGetProfile(convexProfileCreditLookupKey(req));
    res.json({
      user: { id: req.user!.id, email: req.user!.email || '' },
      profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/account/settings
 * Body fields mirror Convex `profiles.updateSettings`.
 */
router.patch(
  '/settings',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const k of [
        'brand_name',
        'website_url',
        'contact_email',
        'widget_show_models',
        'widget_fit_recommendations',
        'widget_auto_detect',
        'widget_collect_analytics',
      ] as const) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: 'No valid settings fields' });
        return;
      }
      await cxPatchProfile(convexProfileCreditLookupKey(req), patch);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/account/compliance
 */
router.patch(
  '/compliance',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { onboarding_goals, completed_at } = req.body as {
        onboarding_goals?: unknown;
        completed_at?: unknown;
      };
      if (!Array.isArray(onboarding_goals) || typeof completed_at !== 'string') {
        res.status(400).json({ error: 'onboarding_goals (array) and completed_at (string) required' });
        return;
      }
      const goals = onboarding_goals.filter((g): g is string => typeof g === 'string');
      await cxPatchProfile(convexProfileCreditLookupKey(req), {
        compliance_onboarding_completed_at: completed_at,
        onboarding_goals: goals,
        updated_at: completed_at,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
