import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { cxGetProfile, cxInsertProfile, cxPatchProfile } from '../services/creditsConvexBridge';
import { DEFAULT_FREE_CREDITS_BUSINESS, DEFAULT_FREE_CREDITS_INDIVIDUAL } from '../services/credits';
import { logger } from '../config/logger';
import { verifyTurnstileToken } from '../services/turnstile';

const router = Router();

/**
 * POST /api/account/session/bootstrap
 * Ensures a Convex `profiles` row exists for the authenticated local-session user.
 */
router.post(
  '/session/bootstrap',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const email = (req.user!.email || '').trim();
      const body = req.body as Record<string, unknown>;
      const turnstileToken =
        typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined;
      const ip = typeof req.ip === 'string' ? req.ip : undefined;
      if (!(await verifyTurnstileToken(turnstileToken, ip))) {
        res.status(403).json({ error: 'Security verification failed. Please try again.' });
        return;
      }

      const accountTypeRaw = body.accountType;
      const at = accountTypeRaw === 'individual' ? 'individual' : 'business';
      const cap = at === 'individual' ? DEFAULT_FREE_CREDITS_INDIVIDUAL : DEFAULT_FREE_CREDITS_BUSINESS;
      const brandName = typeof body.brandName === 'string' ? body.brandName : undefined;
      const fullName = typeof body.fullName === 'string' ? body.fullName : undefined;
      const role = typeof body.role === 'string' ? body.role : undefined;

      const existing = await cxGetProfile(userId);
      if (existing) {
        await cxPatchProfile(userId, {
          contact_email: email || existing.contact_email,
          ...(brandName !== undefined ? { brand_name: brandName } : {}),
          ...(fullName !== undefined ? { full_name: fullName } : {}),
          ...(role !== undefined ? { role } : {}),
          account_type: at,
        });
        res.json({ ok: true, created: false });
        return;
      }

      await cxInsertProfile(userId, at, cap, cap);
      await cxPatchProfile(userId, {
        contact_email: email || undefined,
        brand_name: brandName,
        full_name: fullName,
        role,
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
    const profile = await cxGetProfile(req.user!.id);
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
      await cxPatchProfile(req.user!.id, patch);
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
      await cxPatchProfile(req.user!.id, {
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
