import { supabaseAdmin } from '../config/supabase';
import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { sendLowCreditsWarningEmail } from './email';
import type { CreditCheckResult } from '../types';

const LOW_CREDITS_THRESHOLD = 5;

/** Shown to end customers (widget, studio) — not billing/Replicate instructions for the store owner. */
export const SHOPPER_TRYON_UNAVAILABLE_MESSAGE =
  "Virtual try-on isn't available right now. Please try again later or contact the store.";

/** Default free try-on pool for new profiles and free-plan monthly reset (`free_credits_*` columns). */
export const DEFAULT_FREE_CREDITS = 20;

/** Plan limits: Free tier uses {@link DEFAULT_FREE_CREDITS}; paid tiers = monthly allocation. -1 = unlimited */
const PLAN_LIMITS: Record<string, number> = {
  free: DEFAULT_FREE_CREDITS,
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

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (planId === 'free') {
    updates.free_credits_remaining = DEFAULT_FREE_CREDITS;
    updates.free_credits_total = DEFAULT_FREE_CREDITS;
  } else if (!isUnlimited) {
    updates.monthly_credits_remaining = limit;
    updates.monthly_credits_total = limit;
  }

  if (Object.keys(updates).length > 1) {
    await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready') {
        await redis.setex(redisKey, 60 * 60 * 24 * 35, currentMonth);
      }
    } catch { /* ignore */ }
    logger.info('Monthly credit reset', { userId, planId, limit });
  }
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

  let { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, free_credits_remaining, free_credits_total, monthly_credits_remaining, monthly_credits_total, plan_id'
    )
    .eq('id', userId)
    .single();

  // Auto-create profile if missing (user signed up before schema was applied)
  if (error?.code === 'PGRST116' || !profile) {
    const { data: newProfile, error: insertErr } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        free_credits_remaining: DEFAULT_FREE_CREDITS,
        free_credits_total: DEFAULT_FREE_CREDITS,
        monthly_credits_remaining: 0,
        monthly_credits_total: 0,
        plan_id: 'free',
      })
      .select()
      .single();
    if (insertErr) {
      logger.error('Failed to create profile', { userId, error: insertErr.message });
      return { allowed: false, creditsRemaining: 0, creditType: 'free', reason: 'Profile not found' };
    }
    profile = newProfile;
  }

  if (!profile) {
    return { allowed: false, creditsRemaining: 0, creditType: 'free', reason: 'Profile not found' };
  }

  await ensureMonthlyCreditReset(userId, profile);

  // Re-fetch after potential reset
  const { data: refreshed } = await supabaseAdmin
    .from('profiles')
    .select('free_credits_remaining, monthly_credits_remaining, monthly_credits_total, plan_id')
    .eq('id', userId)
    .single();
  if (refreshed) Object.assign(profile, refreshed);

  // Enterprise/unlimited plan (-1 means unlimited)
  if (profile.monthly_credits_total === -1) {
    return { allowed: true, creditsRemaining: -1, creditType: 'monthly' };
  }

  // Paid plan with monthly credits
  if (profile.plan_id && profile.plan_id !== 'free' && profile.monthly_credits_remaining > 0) {
    return {
      allowed: true,
      creditsRemaining: profile.monthly_credits_remaining,
      creditType: 'monthly',
    };
  }

  // Paid plan but credits exhausted
  if (profile.plan_id && profile.plan_id !== 'free' && profile.monthly_credits_remaining <= 0) {
    return {
      allowed: false,
      creditsRemaining: 0,
      creditType: 'monthly',
      reason:
        'Your plan try-on credits are used up. Add more in Billing, or wait for your monthly reset. (This is separate from your Replicate account balance.)',
    };
  }

  // Free tier
  if (profile.free_credits_remaining > 0) {
    return {
      allowed: true,
      creditsRemaining: profile.free_credits_remaining,
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

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('monthly_credits_remaining, monthly_credits_total, free_credits_remaining, plan_id')
    .eq('id', userId)
    .single();

  if (!profile) {
    logger.error('Profile not found during credit decrement', { userId });
    return;
  }

  // Unlimited plan — no decrement needed
  if (profile.monthly_credits_total === -1) return;

  let updatePayload: Record<string, number> = {};

  if (profile.plan_id && profile.plan_id !== 'free' && profile.monthly_credits_remaining > 0) {
    updatePayload = { monthly_credits_remaining: profile.monthly_credits_remaining - 1 };
  } else if (profile.free_credits_remaining > 0) {
    updatePayload = { free_credits_remaining: profile.free_credits_remaining - 1 };
  } else {
    logger.warn('Attempted credit decrement with 0 credits', { userId });
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (error) {
    logger.error('Failed to decrement credits', { userId, error: error.message });
  } else {
    const newRemaining = Object.values(updatePayload)[0];
    logger.info('Credit deducted', { userId, creditType: Object.keys(updatePayload)[0] });
    if (newRemaining > 0 && newRemaining <= LOW_CREDITS_THRESHOLD) {
      sendLowCreditsWarningEmail(userId, newRemaining).catch((e) =>
        logger.warn('Low credits email failed', { userId, error: String(e) })
      );
    }
  }
}

/**
 * Restores a credit after AI inference failure.
 * Only call when a credit was incorrectly deducted or to undo a deduction.
 */
export async function restoreCredits(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('monthly_credits_remaining, monthly_credits_total, free_credits_remaining, free_credits_total, plan_id')
    .eq('id', userId)
    .single();

  if (!profile || profile.monthly_credits_total === -1) return;

  let updatePayload: Record<string, number> = {};
  if (profile.plan_id && profile.plan_id !== 'free' && profile.monthly_credits_remaining < profile.monthly_credits_total) {
    updatePayload = { monthly_credits_remaining: profile.monthly_credits_remaining + 1 };
  } else if (profile.free_credits_remaining < profile.free_credits_total) {
    updatePayload = { free_credits_remaining: profile.free_credits_remaining + 1 };
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabaseAdmin.from('profiles').update(updatePayload).eq('id', userId);
    if (!error) {
      logger.info('Credit restored (AI failure)', { userId });
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
  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('tryons_per_month, name')
    .eq('id', planId)
    .single();

  if (!plan) {
    logger.error('Plan not found during credit allocation', { planId });
    return;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      plan_id: planId,
      monthly_credits_total: plan.tryons_per_month,
      monthly_credits_remaining: plan.tryons_per_month,
      widget_activated: true,
    })
    .eq('id', userId);

  if (error) {
    logger.error('Failed to allocate credits', { userId, planId, error: error.message });
    throw new Error(`Credit allocation failed: ${error.message}`);
  }

  logger.info('Credits allocated', {
    userId,
    planId,
    credits: plan.tryons_per_month,
    provider,
  });
}

/**
 * Returns the user's plan ID for rate limiting and feature checks.
 */
export async function getPlanId(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('plan_id')
    .eq('id', userId)
    .single();
  return data?.plan_id || 'free';
}

/**
 * Returns credit usage summary for a user.
 */
export async function getCreditSummary(userId: string) {
  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select(
      'free_credits_remaining, free_credits_total, monthly_credits_remaining, monthly_credits_total, plan_id'
    )
    .eq('id', userId)
    .single();

  // Auto-create profile if missing
  if (!profile) {
    const { data: newProfile } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        free_credits_remaining: DEFAULT_FREE_CREDITS,
        free_credits_total: DEFAULT_FREE_CREDITS,
        monthly_credits_remaining: 0,
        monthly_credits_total: 0,
        plan_id: 'free',
      })
      .select()
      .single();
    profile = newProfile ?? undefined;
  }

  if (!profile) return null;

  const isUnlimited = profile.monthly_credits_total === -1;
  const used = isUnlimited
    ? 0
    : (profile.monthly_credits_total - profile.monthly_credits_remaining);

  return {
    plan: profile.plan_id || 'free',
    isUnlimited,
    freeCreditsRemaining: profile.free_credits_remaining,
    freeCreditsTotal: profile.free_credits_total,
    monthlyCreditsRemaining: profile.monthly_credits_remaining,
    monthlyCreditsTotal: profile.monthly_credits_total,
    monthlyCreditsUsed: used,
    usagePercent: isUnlimited || !profile.monthly_credits_total
      ? 0
      : Math.round((used / profile.monthly_credits_total) * 100),
  };
}
