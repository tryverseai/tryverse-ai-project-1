import { query } from "./_generated/server";

/** Signed-in user for dashboard hooks (Convex Auth JWT). */
export const sessionUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      id: identity.subject,
      email: identity.email ?? null,
    };
  },
});

/**
 * Express `Authorization: Bearer` verification — same JWT as the browser Convex client.
 */
export const verifyBearerSession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", identity.subject))
      .unique();
    return {
      id: identity.subject,
      email: identity.email ?? null,
      is_blocked: profile?.is_blocked ?? false,
    };
  },
});
