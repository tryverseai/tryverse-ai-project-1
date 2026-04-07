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
  type ConvexProfileRow,
} from './creditsConvexBridge';

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
export const DEFAULT_FREE_CREDITS_BUSINESS = 20;

/** @deprecated Use {@link DEFAULT_FREE_CREDITS_BUSINESS} or account-type helpers. */
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

  const planId = profile.plan_id || 'free';
  const limit = PLAN_LIMITS[planId] ?? 0;
  const isUnlimited = limit === -1;
  const freeCap = freePoolCapForAccountType(profile.account_type);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (planId === 'free') {
    updates.free_credits_remaining = freeCap;
    updates.free_credits_total = freeCap;
  } else if (!isUnlimited) {
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
    logger.info('Monthly credit reset', { userId, planId, limit: planId === 'free' ? freeCap : limit });
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
 * Checks if a user has credits remaining.
 * Priority: monthly credits (paid plan) > free credits.
 * Enterprise bypasses all checks.
 */
export async function checkCredits(userId: string): Promise<CreditCheckResult> {
  if (env.NODE_ENV !== 'production' && env.TRYON_SKIP_CREDIT_CHECK) {
    logger.warn('Try-on credit check skipped (TRYON_SKIP_CREDIT_CHECK)', { userId });
    return { allowed: true, creditsRemaining: 999999, creditType: 'monthly' };
  }

  let profile = await cxGetProfile(userId);

  if (!profile) {
    const acct = await accountTypeFromConvexUser(userId);
    const cap = freePoolCapForAccountType(acct);
    try {
      await cxInsertProfile(userId, acct, cap, cap);
    } catch (insertErr) {
      logger.error('Failed to create profile', { userId, error: String(insertErr) });
      return { allowed: false, creditsRemaining: 0, creditType: 'free', reason: 'Profile not found' };
    }
    profile = await cxGetProfile(userId);
  }

  if (!profile) {
    return { allowed: false, creditsRemaining: 0, creditType: 'free', reason: 'Profile not found' };
  }

  profile = await hydrateProfileWithAccountType(userId, profile);
  if (!profile) {
    return { allowed: false, creditsRemaining: 0, creditType: 'free', reason: 'Profile not found' };
  }

  const migratedFree = await migrateLegacyFreeCreditsIfNeeded(userId, narrowCreditFields(profile));
  profile = { ...profile, ...migratedFree };

  const reconciled = await reconcileIndividualFreePoolCap(userId, narrowCreditFields(profile));
  profile = { ...profile, ...reconciled };

  await ensureMonthlyCreditReset(userId, narrowCreditFields(profile));

  const refreshed = await cxGetProfile(userId);
  if (refreshed) Object.assign(profile, refreshed);

  const pf = narrowCreditFields(profile);

  // Enterprise/unlimited plan (-1 means unlimited)
  if (pf.monthly_credits_total === -1) {
    return { allowed: true, creditsRemaining: -1, creditType: 'monthly' };
  }

  // Paid plan with monthly credits
  if (pf.plan_id && pf.plan_id !== 'free' && pf.monthly_credits_remaining > 0) {
    return {
      allowed: true,
      creditsRemaining: pf.monthly_credits_remaining,
      creditType: 'monthly',
    };
  }

  // Paid plan but credits exhausted
  if (pf.plan_id && pf.plan_id !== 'free' && pf.monthly_credits_remaining <= 0) {
    return {
      allowed: false,
      creditsRemaining: 0,
      creditType: 'monthly',
      reason:
        'Your plan try-on credits are used up. Add more in Billing, or wait for your monthly reset. (This is separate from your Replicate account balance.)',
    };
  }

  // Free tier
  if (pf.free_credits_remaining > 0) {
    return {
      allowed: true,
      creditsRemaining: pf.free_credits_remaining,
      creditType: 'free',
    };
  }

  return {
    allowed: false,
    creditsRemaining: 0,
    creditType: 'free',
    reason:
      'Your TryVerse try-on credits are used up (free tier is limited). Subscribe or upgrade in Billing for more. Note: your Replicate API wallet is separate and does not refill TryVerse credits.',
  };
}

/**
 * Atomically decrements credits for a user after a successful try-on.
 * Uses a Supabase RPC to ensure atomicity.
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
 * Restores a credit after AI inference failure.
 * Only call when a credit was incorrectly deducted or to undo a deduction.
 */
export async function restoreCredits(userId: string): Promise<void> {
  const profile = await cxGetProfile(userId);

  if (!profile || profile.monthly_credits_total === -1) return;

  let updatePayload: Record<string, number> = {};
  const planId = String(profile.plan_id ?? '');
  const monthlyRem = Number(profile.monthly_credits_remaining ?? 0);
  const monthlyTot = Number(profile.monthly_credits_total ?? 0);
  const freeRem = Number(profile.free_credits_remaining ?? 0);
  const freeTot = Number(profile.free_credits_total ?? 0);
  if (planId && planId !== 'free' && monthlyRem < monthlyTot) {
    updatePayload = { monthly_credits_remaining: monthlyRem + 1 };
  } else if (freeRem < freeTot) {
    updatePayload = { free_credits_remaining: freeRem + 1 };
  }

  if (Object.keys(updatePayload).length > 0) {
    try {
      await cxPatchProfile(userId, updatePayload);
      logger.info('Credit restored (AI failure)', { userId });
    } catch {
      /* ignore */
    }
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
 */
export async function getCreditSummary(userId: string) {
  let profile = await cxGetProfile(userId);

  if (!profile) {
    const acct = await accountTypeFromConvexUser(userId);
    const cap = freePoolCapForAccountType(acct);
    try {
      await cxInsertProfile(userId, acct, cap, cap);
    } catch {
      /* ignore */
    }
    profile = await cxGetProfile(userId);
  }

  if (!profile) return null;

  profile = await hydrateProfileWithAccountType(userId, profile);
  if (!profile) return null;

  const migratedFree = await migrateLegacyFreeCreditsIfNeeded(userId, narrowCreditFields(profile));
  profile = { ...profile, ...migratedFree };

  const reconciled = await reconcileIndividualFreePoolCap(userId, narrowCreditFields(profile));
  profile = { ...profile, ...reconciled };

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
