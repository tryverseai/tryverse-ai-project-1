import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Removes a user's Convex Auth identity entirely: the `authAccounts` row (password hash),
 * every `authSessions` row, and each session's `authRefreshTokens` rows — not just the app-level
 * profile/data a cascade-delete otherwise removes.
 *
 * `@convex-dev/auth`'s own `invalidateSessions` helper does the equivalent for sessions, but it
 * requires a `GenericActionCtx` (it calls `runAction`/`vectorSearch` internally) — account
 * deletion here runs as a `mutation`, called synchronously from Express via `convexMutationTrusted`,
 * and restructuring it into an action is a bigger change than this fix calls for. This replicates
 * the essential effect (every session and its refresh tokens deleted) directly via `ctx.db`, which
 * a mutation context can do.
 */
export async function deleteAuthAccountAndSessions(ctx: MutationCtx, userDocId: Id<"users">): Promise<void> {
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userDocId))
    .collect();
  for (const account of accounts) await ctx.db.delete(account._id);

  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userDocId))
    .collect();
  for (const session of sessions) {
    const refreshTokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .collect();
    for (const token of refreshTokens) await ctx.db.delete(token._id);
    await ctx.db.delete(session._id);
  }
}
