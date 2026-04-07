import { query } from "./_generated/server";

/** Public catalog of active pricing plans (replaces `plans` + `is_active` filter from Supabase). */
export const listActivePlans = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("plans").collect();
    return all
      .filter((p) => p.is_active)
      .sort((a, b) => a.tryons_per_month - b.tryons_per_month);
  },
});
