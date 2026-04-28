import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authSubjectSegments } from "./authSubjectKeys";

/** Resolve a profile row when `id` may be any segment of a compound Convex Auth subject. */
export async function findProfileBySubjectKeys(
  ctx: QueryCtx | MutationCtx,
  subject: string,
): Promise<Doc<"profiles"> | null> {
  for (const key of authSubjectSegments(subject)) {
    const row = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", key))
      .unique();
    if (row) return row;
  }
  return null;
}
