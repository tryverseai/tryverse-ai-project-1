import { internalMutation } from "./_generated/server";
import { findProfileBySubjectKeys } from "./profileLookup";

/**
 * Daily safety net for expired subscriptions whose cancellation/non-renewal webhook was missed or
 * never arrives. Paystack's `subscription.disable` and Flutterwave's `subscription.cancelled` are
 * both webhook-only signals with no delivery guarantee — Flutterwave's own community forum
 * documents merchants not receiving cancellation webhooks at all. Without this, a lapsed
 * subscription with a missed webhook leaves the account on its paid plan (and paid credit
 * allotment) indefinitely, since every entitlement check reads `profiles.plan_id`, never
 * `subscriptions.status` directly.
 *
 * Scans for subscriptions still marked "active" whose paid period has already ended, and
 * downgrades those accounts to the free plan — the same terminal state the webhook-driven
 * cancellation handlers (`paystack.ts`) reach when they do fire correctly. Also marks the
 * subscription row "expired" so the same row isn't reprocessed on the next run.
 */
export const reconcileExpiredSubscriptions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const nowIso = new Date().toISOString();

    const freePlan = await ctx.db
      .query("plans")
      .withIndex("by_planId", (q) => q.eq("id", "free"))
      .unique();
    const freeCredits = freePlan ? Number(freePlan.tryons_per_month ?? 0) : 0;

    const allSubscriptions = await ctx.db.query("subscriptions").collect();
    const expired = allSubscriptions.filter(
      (s) => s.status === "active" && s.current_period_end && s.current_period_end < nowIso
    );

    let downgraded = 0;
    for (const sub of expired) {
      await ctx.db.patch(sub._id, { status: "expired", updated_at: nowIso });

      const profile = await findProfileBySubjectKeys(ctx, sub.user_id);
      if (!profile) continue;
      // Don't clobber a plan the account has already moved to since this subscription lapsed
      // (e.g. they resubscribed on a different provider, or an admin manually adjusted them).
      if (profile.plan_id !== sub.plan_id) continue;

      await ctx.db.patch(profile._id, {
        plan_id: "free",
        monthly_credits_total: freeCredits,
        monthly_credits_remaining: freeCredits,
      } as never);
      downgraded++;
    }

    return { scanned: allSubscriptions.length, expired: expired.length, downgraded };
  },
});
