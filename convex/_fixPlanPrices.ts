import { mutation } from "./_generated/server";

// One-off migration — deploy, run once, delete. Corrects already-seeded plan rows
// (seed defaults only apply to first insert, not existing rows) to the authoritative
// pricing: Starter NGN150000/USD150, Growth NGN200000/USD250.
export const fixPlanPrices = mutation({
  args: {},
  handler: async (ctx) => {
    const updates = [
      { id: "starter", price_ngn: 150000, price_usd: 150 },
      { id: "growth", price_ngn: 200000, price_usd: 250 },
    ];
    const results: { id: string; before: { price_ngn: number; price_usd: number } | null; after: { price_ngn: number; price_usd: number } }[] = [];
    for (const u of updates) {
      const row = await ctx.db
        .query("plans")
        .withIndex("by_planId", (q) => q.eq("id", u.id))
        .unique();
      if (!row) {
        results.push({ id: u.id, before: null, after: { price_ngn: u.price_ngn, price_usd: u.price_usd } });
        continue;
      }
      const before = { price_ngn: row.price_ngn, price_usd: row.price_usd };
      await ctx.db.patch(row._id, { price_ngn: u.price_ngn, price_usd: u.price_usd });
      results.push({ id: u.id, before, after: { price_ngn: u.price_ngn, price_usd: u.price_usd } });
    }
    return results;
  },
});
