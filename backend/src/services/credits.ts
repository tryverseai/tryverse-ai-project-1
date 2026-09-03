import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { sendLowCreditsWarningEmail } from './email';
import type { CreditCheckResult } from '../types';
import {
  cxGetProfile,
  cxPatchProfile,
  cxInsertProfile,
  cxGetUserRow,
  cxGetPlan,
  cxReserveCredit,
  cxRestoreCredit,
  type ConvexProfileRow,
} from './creditsConvexBridge';

/**
 * TryVerse-credit cost per AI operation. Derived from FASHN's real per-operation credit costs
 * (confirmed against docs.fashn.ai, Aug 2026) at ~$0.07/FASHN-credit blended, sized so existing
 * plan pools (Free 10, Starter 150, Growth 750) carry healthy margin without needing to be
 * inflated: Starter's 150-credit pool costs ~$10.50 in FASHN COGS against $150 revenue.
 */
export const CREDIT_COSTS = {
  tryOn: 1,
  outfit: 2,
  aiModel: 2,
  aiModelFaceRef: 4,
  photoshoot: 2,
  photoshootFaceRef: 4,
  video: {
    '480p': { 5: 1, 10: 2 },
    '720p': { 5: 2, 10: 4 },
    '1080p': { 5: 3, 10: 6 },
  } as Record<'480p' | '720p' | '1080p', Record<5 | 10, number>>,
} as const;

export function videoCreditCost(resolution: '480p' | '720p' | '1080p', duration: 5 | 10): number {
  return CREDIT_COSTS.video[resolution][duration];
}

const LOW_CREDITS_THRESHOLD = 5;

function narrowCreditFields(p: ConvexProfileRow): {
  plan_id: string | null;
  account_type?: string | null;
  free_credits_remaining: number;
  free_credits_total: number;
  monthly_credits_remaining: number;
  monthly_credits_total: number;
} {
  return {
    plan_id: typeof p.plan_id === 'string' ? p.plan_id : null,
    account_type: p.account_type,
    free_credits_remaining: Number(p.free_credits_remaining ?? 0),
    free_credits_total: Number(p.free_credits_total ?? 0),
    monthly_credits_remaining: Number(p.monthly_credits_remaining ?? 0),
    monthly_credits_total: Number(p.monthly_credits_total ?? 0),
  };
}

/** Shown to end customers (widget, studio) — not billing/Replicate instructions for the store owner. */
export const SHOPPER_TRYON_UNAVAILABLE_MESSAGE =
  "Virtual try-on isn't available right now. Please try again later or contact the store.";

/** B2C free try-on pool (upper end of 3–5 range; cap enforced on reset & reconcile). */
export const DEFAULT_FREE_CREDITS_INDIVIDUAL = 5;

/** B2B / brand free try-on pool on free plan. */
export const DEFAULT_FREE_CREDITS_BUSINESS = 10;

/**
 * @deprecated Use {@link DEFAULT_FREE_CREDITS_BUSINESS} or {@link freePoolCapForAccountType}.
 * Retained only for backward compatibility; will be removed in a future cleanup.
 */
export const DEFAULT_FREE_CREDITS = DEFAULT_FREE_CREDITS_BUSINESS;

export function freePoolCapForAccountType(accountType: string | null | undefined): number {
  const t = String(accountType ?? 'business')
    .trim()
    .toLowerCase();
  return t === 'individual' ? DEFAULT_FREE_CREDITS_INDIVIDUAL : DEFAULT_FREE_CREDITS_BUSINESS;
}

/** Older signups used a 3-try free pool; migrate cap depends on account_type. */
const LEGACY_FREE_CREDITS_TOTAL = 3;

async function accountTypeFromConvexUser(userId: string): Promise<'individual' | 'business'> {
  const row = await cxGetUserRow(userId);
  const s = String(row?.account_type ?? '')
    .trim()
    .toLowerCase();
  return s === 'individual' ? 'individual' : 'business';
}

/**
 * One-time migration from legacy 3-cap pool to account-type-aware free pool.
 */
async function migrateLegacyFreeCreditsIfNeeded(
  userId: string,
  profile: {
    plan_id: string | null;
    account_type?: string | null;
    free_credits_remaining: number;
    free_credits_total: number;
  }
): Promise<{ free_credits_remaining: number; free_credits_total: number }> {
  const planId = profile.plan_id || 'free';
  if (planId !== 'free') {
    return {
      free_credits_remaining: profile.free_credits_remaining,
      free_credits_total: profile.free_credits_total,
    };
  }
  if (profile.free_credits_total !== LEGACY_FREE_CREDITS_TOTAL) {
    return {
      free_credits_remaining: profile.free_credits_remaining,
      free_credits_total: profile.free_credits_total,
    };
  }

  const cap = freePoolCapForAccountType(profile.account_type);
  const bonus = cap - LEGACY_FREE_CREDITS_TOTAL;
  const newRemaining = Math.min(cap, profile.free_credits_remaining + bonus);
  const newTotal = cap;

  try {
    await cxPatchProfile(userId, {
      free_credits_remaining: newRemaining,
      free_credits_total: newTotal,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.warn('Legacy free credits migration failed', { userId, message: String(e) });
    return {
      free_credits_remaining: profile.free_credits_remaining,
      free_credits_total: profile.free_credits_total,
    };
  }

  logger.info('Migrated legacy free credits pool (3 → account cap)', {
    userId,
    newRemaining,
    newTotal,
    accountType: profile.account_type,
  });
  return { free_credits_remaining: newRemaining, free_credits_total: newTotal };
}

/**
 * Individuals on free plan should not keep a business-sized (20) pool — cap to individual limit.
 */
async function reconcileIndividualFreePoolCap(
  userId: string,
  profile: {
    plan_id: string | null;
    account_type?: string | null;
    free_credits_remaining: number;
    free_credits_total: number;
  }
): Promise<{ free_credits_remaining: number; free_credits_total: number }> {
  const planId = profile.plan_id || 'free';
  if (planId !== 'free') {
    return {
      free_credits_remaining: profile.free_credits_remaining,
      free_credits_total: profile.free_credits_total,
    };
  }
  const cap = freePoolCapForAccountType(profile.account_type);
  if (profile.free_credits_total <= cap && profile.free_credits_remaining <= cap) {
    return {
      free_credits_remaining: profile.free_credits_remaining,
      free_credits_total: profile.free_credits_total,
    };
  }

  const newTotal = cap;
  const newRem = Math.min(profile.free_credits_remaining, cap);

  try {
    await cxPatchProfile(userId, {
      free_credits_remaining: newRem,
      free_credits_total: newTotal,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.warn('Individual free pool cap reconcile failed', { userId, message: String(e) });
    return {
      free_credits_remaining: profile.free_credits_remaining,
      free_credits_total: profile.free_credits_total,
    };
  }

  if (newTotal !== profile.free_credits_total || newRem !== profile.free_credits_remaining) {
    logger.info('Reconciled free pool to account-type cap', { userId, cap });
  }
  return { free_credits_remaining: newRem, free_credits_total: newTotal };
}

/** Paid tier monthly try-on limits (free uses account-type pool, not this map). */
const PLAN_LIMITS: Record<string, number> = {
  free: 0,
  starter: 100,
  growth: 1000,
  enterprise: -1,
};

/**
 * Resets monthly credits at the start of each billing month.
 * Uses Redis to track last reset month (avoids schema changes).
 */
async function ensureMonthlyCreditReset(
  userId: string,
  profile: {
    plan_id: string | null;
    account_type?: string | null;
    free_credits_remaining: number;
    free_credits_total: number;
    monthly_credits_remaining: number;
    monthly_credits_total: number;
  }
): Promise<void> {
  const planId = profile.plan_id || 'free';

  // Free tier uses a persistent try-on pool (depleted by usage until upgrade/top-up).
  // Never refill it here — previous logic treated `plan===free` like a monthly reset and
  // restored remaining credits to the cap on every Redis miss (e.g. new month key),
  // wiping real consumption after logout/login or the next try-on.
  if (planId === 'free') {
    return;
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const redisKey = `credits:reset:${userId}`;

  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      const lastReset = await redis.get(redisKey);
      if (lastReset === currentMonth) return; // Already reset this month
    }
  } catch {
    // Redis unavailable — skip reset (will retry next request)
    return;
  }

  const limit = PLAN_LIMITS[planId] ?? 0;
  const isUnlimited = limit === -1;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!isUnlimited) {
    updates.monthly_credits_remaining = limit;
    updates.monthly_credits_total = limit;
  }

  if (Object.keys(updates).length > 1) {
    await cxPatchProfile(userId, updates);
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready') {
        await redis.setex(redisKey, 60 * 60 * 24 * 35, currentMonth);
      }
    } catch { /* ignore */ }
    logger.info('Monthly credit reset', { userId, planId, limit });
  }
}

async function hydrateProfileWithAccountType<T extends { account_type?: string | null }>(
  userId: string,
  profile: T | null
): Promise<T | null> {
  if (!profile) return null;
  if (profile.account_type === 'individual' || profile.account_type === 'business') {
    return profile;
  }
  const row = await cxGetProfile(userId);
  const at = row?.account_type;
  if (typeof at === 'string' && (at === 'individual' || at === 'business')) {
    return { ...profile, account_type: at };
  }
  return { ...profile, account_type: await accountTypeFromConvexUser(userId) };
}

/**
 * Loads, hydrates, and normalizes a user's credit profile.
 * Shared between `checkCredits` and `getCreditSummary` to keep the bootstrap
 * sequence (get-or-create → hydrate account type → migrate legacy caps → reconcile
 * individual cap) in one place.
 *
 * Does NOT trigger monthly credit resets — `checkCredits` does that separately
 * to avoid resetting credits during a read-only summary request.
 *
 * Returns `null` only when the profile cannot be created or retrieved.
 */
async function buildCreditProfile(userId: string): Promise<ConvexProfileRow | null> {
  let profile = await cxGetProfile(userId);

  if (!profile) {
    const acct = await accountTypeFromConvexUser(userId);
    const cap = freePoolCapForAccountType(acct);
    try {
      await cxInsertProfile(userId, acct, cap, cap);
    } catch (insertErr) {
      logger.error('Failed to create profile', { userId, error: String(insertErr) });
      return null;
    }
    profile = await cxGetProfile(userId);
  }

  if (!profile) return null;

  profile = await hydrateProfileWithAccountType(userId, profile);
  if (!profile) return null;

  const migratedFree = await migrateLegacyFreeCreditsIfNeeded(userId, narrowCreditFields(profile));
  profile = { ...profile, ...migratedFree };

  const reconciled = await reconcileIndividualFreePoolCap(userId, narrowCreditFields(profile));
  return { ...profile, ...reconciled };
}

/**
 * Checks if a user has credits remaining.
 * Priority: monthly credits (paid plan) > free credits.
 * Enterprise bypasses all checks.
 */
export async function checkCredits(userId: string, amount = 1): Promise<CreditCheckResult> {
  if (env.NODE_ENV !== 'production' && env.TRYON_SKIP_CREDIT_CHECK) {
    logger.warn('Try-on credit check skipped (TRYON_SKIP_CREDIT_CHECK)', { userId });
    return { allowed: true, creditsRemaining: 999999, creditType: 'monthly' };
  }

  let profile = await buildCreditProfile(userId);
  if (!profile) {
    return { allowed: false, creditsRemaining: 0, creditType: 'free', reason: 'Profile not found' };
  }

  // Trigger monthly credit reset (only checkCredits should do this, not getCreditSummary).
  await ensureMonthlyCreditReset(userId, narrowCreditFields(profile));

  const refreshed = await cxGetProfile(userId);
  if (refreshed) Object.assign(profile, refreshed);

  const pf = narrowCreditFields(profile);

  // Enterprise / unlimited plan (-1 means unlimited) — no decrement needed
  if (pf.monthly_credits_total === -1) {
    return { allowed: true, creditsRemaining: -1, creditType: 'monthly' };
  }

  // Fast-path: credits already exhausted — skip the reservation mutation
  const hasPaidCredits = Boolean(pf.plan_id && pf.plan_id !== 'free' && pf.monthly_credits_remaining >= amount);
  const hasFreeCredits = pf.free_credits_remaining >= amount;

  if (!hasPaidCredits && !hasFreeCredits) {
    if (pf.plan_id && pf.plan_id !== 'free') {
      return {
        allowed: false,
        creditsRemaining: pf.monthly_credits_remaining,
        creditType: 'monthly',
        reason: 'Your plan credits are used up. Add more in Billing, or wait for your monthly reset.',
      };
    }
    return {
      allowed: false,
      creditsRemaining: pf.free_credits_remaining,
      creditType: 'free',
      reason: 'Your free credits are used up. Upgrade in Billing for more.',
    };
  }

  // M-5: Atomically reserve (decrement) the credit inside a Convex mutation.
  // Because Convex mutations are serialized at the document level, two concurrent
  // requests cannot both succeed when only `amount` or fewer credits remain — eliminating
  // the read-then-check overdraft race.
  // NOTE: The credit is now decremented here. Do NOT call decrementCredits in the
  // pipeline for requests that go through this path; only restoreCredits on failure.
  let reservation: Awaited<ReturnType<typeof cxReserveCredit>>;
  try {
    reservation = await cxReserveCredit(userId, amount);
  } catch (e) {
    logger.error('Atomic credit reservation failed', { userId, amount, error: String(e) });
    return { allowed: false, creditsRemaining: 0, creditType: hasPaidCredits ? 'monthly' : 'free', reason: 'Credit reservation error' };
  }

  if (!reservation.ok) {
    // Another concurrent request grabbed the credits between our fast-path check and the mutation
    return {
      allowed: false,
      creditsRemaining: 0,
      creditType: hasPaidCredits ? 'monthly' : 'free',
      reason: reservation.reason ?? 'No credits remaining',
    };
  }

  const creditsAfterReserve = hasPaidCredits
    ? pf.monthly_credits_remaining - amount
    : pf.free_credits_remaining - amount;

  return {
    allowed: true,
    creditsRemaining: Math.max(0, creditsAfterReserve),
    creditType: (reservation.creditType ?? (hasPaidCredits ? 'monthly' : 'free')) as 'monthly' | 'free',
  };
}

/**
 * @deprecated The try-on pipeline no longer calls this function.
 * Credits are now reserved atomically by `checkCredits` via `cxReserveCredit`
 * (a Convex mutation) at the start of each request, eliminating the
 * read-then-decrement race condition.  Use `restoreCredits` on pipeline failure.
 *
 * Retained here only for admin / manual credit corrections.
 * Do NOT re-introduce calls in the automatic try-on path.
 */
export async function decrementCredits(userId: string): Promise<void> {
  if (env.NODE_ENV !== 'production' && env.TRYON_SKIP_CREDIT_CHECK) {
    return;
  }

  const profile = await cxGetProfile(userId);

  if (!profile) {
    logger.error('Profile not found during credit decrement', { userId });
    return;
  }

  // Unlimited plan — no decrement needed
  if (profile.monthly_credits_total === -1) return;

  let updatePayload: Record<string, number> = {};

  const planId = String(profile.plan_id ?? 'free');
  const monthlyRem = Number(profile.monthly_credits_remaining ?? 0);
  const monthlyTot = Number(profile.monthly_credits_total ?? 0);
  const freeRem = Number(profile.free_credits_remaining ?? 0);

  if (planId && planId !== 'free' && monthlyRem > 0) {
    updatePayload = { monthly_credits_remaining: monthlyRem - 1 };
  } else if (freeRem > 0) {
    updatePayload = { free_credits_remaining: freeRem - 1 };
  } else {
    logger.warn('Attempted credit decrement with 0 credits', { userId });
    return;
  }

  try {
    await cxPatchProfile(userId, updatePayload);
    const newRemaining = Object.values(updatePayload)[0];
    logger.info('Credit deducted', { userId, creditType: Object.keys(updatePayload)[0] });
    if (newRemaining > 0 && newRemaining <= LOW_CREDITS_THRESHOLD) {
      sendLowCreditsWarningEmail(userId, newRemaining).catch((e) =>
        logger.warn('Low credits email failed', { userId, error: String(e) })
      );
    }
  } catch (err) {
    logger.error('Failed to decrement credits', { userId, error: String(err) });
  }
}

/**
 * Restores `amount` credits after AI inference failure (atomic — mirrors the reservation).
 * Only call when credits were reserved by `checkCredits` and the generation then failed.
 */
/**
 * @param creditType Pass the `creditType` from the original `checkCredits()` result whenever it's
 * available — restores to that exact pool instead of guessing (see cxRestoreCredit's doc comment).
 */
/**
 * `refundKey` should be a stable identifier for the generation record being refunded (e.g.
 * `tryon:<tryonDbId>`), NOT the Bull job id — Bull retries re-run the same job (and can call this
 * on every failed attempt, see JOB_MAX_RETRIES), so a job-scoped key would still allow multiple
 * refunds for one original reservation. A record-scoped key survives every retry unchanged,
 * making the Convex-side dedup (`credit_refund_dedup`) actually collapse them to one restore.
 * Omitting it restores the old (non-idempotent) behavior — every automatic generation-failure
 * call site should pass one.
 */
export async function restoreCredits(
  userId: string,
  amount = 1,
  creditType?: 'monthly' | 'free',
  refundKey?: string
): Promise<void> {
  try {
    const result = await cxRestoreCredit(userId, amount, creditType, refundKey);
    if (result.deduped) {
      logger.info('Credit restore skipped (already refunded for this record)', { userId, amount, refundKey });
    } else {
      logger.info('Credit restored (AI failure)', { userId, amount, creditType, refundKey });
    }
  } catch (e) {
    logger.warn('Credit restore failed', { userId, amount, error: String(e) });
  }
}

/**
 * Allocates credits to a user after a successful payment.
 * Called from payment webhook handlers.
 */
export async function allocateCredits(
  userId: string,
  planId: string,
  provider: string
): Promise<void> {
  const plan = await cxGetPlan(planId);

  if (!plan) {
    logger.error('Plan not found during credit allocation', { planId });
    return;
  }

  const tryons = Number(plan.tryons_per_month ?? 0);

  try {
    await cxPatchProfile(userId, {
      plan_id: planId,
      monthly_credits_total: tryons,
      monthly_credits_remaining: tryons,
      widget_activated: true,
    });
  } catch (error) {
    logger.error('Failed to allocate credits', { userId, planId, error: String(error) });
    throw new Error(`Credit allocation failed: ${String(error)}`);
  }

  logger.info('Credits allocated', {
    userId,
    planId,
    credits: tryons,
    provider,
  });
}

/**
 * Returns the user's plan ID for rate limiting and feature checks.
 */
export async function getPlanId(userId: string): Promise<string> {
  const row = await cxGetProfile(userId);
  const pid = row && typeof row.plan_id === 'string' ? row.plan_id : null;
  return pid || 'free';
}

/**
 * Returns credit usage summary for a user.
 * Uses `buildCreditProfile` for the shared setup; does NOT trigger monthly resets
 * (that is `checkCredits`'s responsibility).
 */
export async function getCreditSummary(userId: string) {
  const profile = await buildCreditProfile(userId);
  if (!profile) return null;

  const pf = narrowCreditFields(profile);

  const isUnlimited = pf.monthly_credits_total === -1;
  const used = isUnlimited ? 0 : pf.monthly_credits_total - pf.monthly_credits_remaining;

  return {
    plan: pf.plan_id || 'free',
    accountType: profile.account_type === 'individual' ? 'individual' : 'business',
    isUnlimited,
    freeCreditsRemaining: pf.free_credits_remaining,
    freeCreditsTotal: pf.free_credits_total,
    monthlyCreditsRemaining: pf.monthly_credits_remaining,
    monthlyCreditsTotal: pf.monthly_credits_total,
    monthlyCreditsUsed: used,
    usagePercent:
      isUnlimited || !pf.monthly_credits_total ? 0 : Math.round((used / pf.monthly_credits_total) * 100),
  };
}
