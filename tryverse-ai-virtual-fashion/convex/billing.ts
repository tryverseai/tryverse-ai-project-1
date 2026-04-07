import { query } from "./_generated/server";

export const getMyBillingSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("user_id", userId))
      .collect();
    const subscription = subs[0] ?? null;

    const allPayments = await ctx.db.query("payments").collect();
    const payments = allPayments.filter((p) => p.user_id === userId);

    payments.sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
    );

    const plans = (await ctx.db.query("plans").collect()).filter((p) => p.is_active);
    plans.sort((a, b) => a.tryons_per_month - b.tryons_per_month);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", userId))
      .unique();

    return {
      subscription,
      payments: payments.slice(0, 10),
      plans,
      profile,
    };
  },
});
