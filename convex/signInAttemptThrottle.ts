import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Brute-force / credential-stuffing throttle for password sign-in, checked from inside
 * TryVersePassword's `authorize` (an action — has no direct `ctx.db`, hence `internalMutation` +
 * `ctx.runMutation`, same pattern as `emailVerificationThrottle.ts`).
 *
 * Deliberately per-EMAIL, not a permanent lockout: a progressive cooldown that grows with
 * consecutive failures but always eventually expires (capped at MAX_COOLDOWN_MS), so an attacker
 * can never use this to permanently deny a real user access to their own account by intentionally
 * failing sign-in against it. Per-IP throttling would add a second, complementary layer (blocking
 * a single source from hammering many accounts) but isn't implemented here — Convex Auth's
 * `authorize` callback isn't given the caller's IP by this app's current auth config, and wiring
 * that through is a larger, separate change; noted as follow-up, not silently skipped.
 *
 * checkThrottle and recordAttemptResult are two separate mutations (not one atomic check-and-act)
 * because the actual credential verification happens in between, in the action layer. This is a
 * deliberate, acceptable trade-off for an abuse-throttle (unlike credits/payments): the narrow
 * race window this opens lets at most a handful of extra guesses through under concurrent
 * requests, not an unbounded bypass, and progressive backoff still closes it down quickly.
 */
const THRESHOLDS: { minFails: number; cooldownMs: number }[] = [
  { minFails: 20, cooldownMs: 30 * 60 * 1000 }, // 30 min
  { minFails: 15, cooldownMs: 10 * 60 * 1000 }, // 10 min
  { minFails: 10, cooldownMs: 2 * 60 * 1000 }, //  2 min
  { minFails: 5, cooldownMs: 30 * 1000 }, //      30 sec
];

function cooldownForFailCount(failCount: number): number {
  for (const t of THRESHOLDS) {
    if (failCount >= t.minFails) return t.cooldownMs;
  }
  return 0;
}

/** Generic message on purpose — identical whether the email exists or not, and identical to the
 * "invalid credentials" message shape elsewhere, so throttling itself can't be used to enumerate
 * valid accounts. */
const THROTTLED_MESSAGE = "Too many sign-in attempts. Please wait a moment and try again.";

export const checkThrottle = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    const row = await ctx.db
      .query("sign_in_attempt_throttle")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (!row) return;
    if (row.locked_until && row.locked_until > Date.now()) {
      throw new Error(THROTTLED_MESSAGE);
    }
  },
});

export const recordAttemptResult = internalMutation({
  args: { email: v.string(), success: v.boolean() },
  handler: async (ctx, { email, success }) => {
    const normalized = email.trim().toLowerCase();
    const now = Date.now();
    const row = await ctx.db
      .query("sign_in_attempt_throttle")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();

    if (success) {
      // Clear the slate on a genuine successful sign-in — a real owner regaining access should
      // never stay throttled because of earlier failed attempts (their own mistyped password, or
      // an attacker's guesses against their account).
      if (row) await ctx.db.delete(row._id);
      return;
    }

    if (!row) {
      await ctx.db.insert("sign_in_attempt_throttle", {
        email: normalized,
        fail_count: 1,
        last_attempt_at: now,
      });
      return;
    }

    const failCount = row.fail_count + 1;
    const cooldownMs = cooldownForFailCount(failCount);
    await ctx.db.patch(row._id, {
      fail_count: failCount,
      last_attempt_at: now,
      locked_until: cooldownMs > 0 ? now + cooldownMs : undefined,
    });
  },
});
