import { query } from "./_generated/server";

export const getMyUsageEvents = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    const rows = await ctx.db
      .query("usage_events")
      .withIndex("by_userId_time", (q) => q.eq("user_id", userId))
      .collect();
    rows.sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
    return rows.map((e) => ({
      event_type: e.event_type,
      created_at: e.created_at ?? "",
    }));
  },
});

export const getWidgetActivated = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", identity.subject))
      .unique();
    return profile?.widget_activated ?? null;
  },
});
