import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { anyApi, convexQueryTrusted } from '../config/convexHttp';
import { convexProfileCreditLookupKey } from './auth';
import { logger } from '../config/logger';

/**
 * Plan tiers this middleware can gate on. Values must match `profiles.plan_id` in Convex
 * (see `convex/seed.ts` and `backend/src/services/credits.ts` PLAN_LIMITS for the full tier
 * list: free | starter | growth | enterprise).
 */
export type GatedPlanTier = 'enterprise';

interface UserPlanTierResult {
  planId: string;
  isEnterprise: boolean;
}

/**
 * Express middleware factory that restricts a route to callers on a given plan tier
 * (currently only `'enterprise'` is a real gate — see `getUserPlanTier` in
 * `convex/backendTrusted.ts`). Intended for the AI Model Generation and AI Video Generation
 * (Higgsfield) features, which must not be reachable by non-Enterprise accounts even if the
 * frontend hides the entry point.
 *
 * Must run AFTER `requireAuth` (or anything else that populates `req.user` / `req.widgetUserId`)
 * — it has no identity of its own to check.
 *
 * This performs a real server-side lookup against the Convex-trusted `getUserPlanTier` query on
 * every request; a client cannot spoof plan tier via headers/body, and hiding a button in the UI
 * has no effect on this check.
 *
 * Usage (apply directly on the route, after requireAuth):
 *
 *   import { requirePlan } from '../middleware/requirePlan';
 *   router.post('/generate', requireAuth, requirePlan('enterprise'), handler);
 *
 * On success, calls `next()` with no side effects. On failure:
 *   - 401 if there's no authenticated caller at all (requireAuth should normally have caught this).
 *   - 403 `{ error: 'enterprise_required', message }` if the caller is authenticated but not on
 *     the required tier.
 *   - Delegates to the app's error handler (`next(err)`, surfaced as 502 by convexQueryTrusted)
 *     if the Convex plan lookup itself fails — fails CLOSED (no access) rather than open.
 */
export function requirePlan(tier: GatedPlanTier) {
  return async function requirePlanMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const userId = convexProfileCreditLookupKey(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const planTier = await convexQueryTrusted<UserPlanTierResult | null>(
        anyApi.backendTrusted.getUserPlanTier,
        { secret: env.BACKEND_SHARED_SECRET, userId }
      );

      const meetsTier = tier === 'enterprise' && planTier?.isEnterprise === true;
      if (!meetsTier) {
        logger.info('requirePlan: access denied — plan tier does not meet requirement', {
          userId,
          requiredTier: tier,
          actualPlanId: planTier?.planId ?? '(no profile)',
          path: req.path,
        });
        res.status(403).json({
          error: 'enterprise_required',
          message: `This feature is available on the Enterprise plan. Upgrade your plan to continue.`,
        });
        return;
      }

      next();
    } catch (err) {
      logger.error('requirePlan: plan tier lookup failed', {
        error: err instanceof Error ? err.message : String(err),
        userId,
        requiredTier: tier,
        path: req.path,
      });
      next(err);
    }
  };
}
