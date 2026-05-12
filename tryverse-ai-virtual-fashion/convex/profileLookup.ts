import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authSubjectSegments, canonicalAuthSubjectProfileId } from "./authSubjectKeys";

/** All `profiles` rows whose `id` matches any lookup key derived from Convex Auth subject. */
export async function collectProfileDocsForSubjectKeys(
  ctx: QueryCtx | MutationCtx,
  subject: string,
): Promise<Doc<"profiles">[]> {
  const raw = subject.trim();
  const seen = new Set<string>();
  const hits: Doc<"profiles">[] = [];
  for (const key of authSubjectSegments(raw)) {
    const rows = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("id", key))
      .collect();
    for (const row of rows) {
      const sid = String(row._id);
      if (!seen.has(sid)) {
        seen.add(sid);
        hits.push(row);
      }
    }
  }
  return hits;
}

/** Single primary row — same picker as merged credit/bootstrap profile. */
export async function findProfileBySubjectKeys(
  ctx: QueryCtx | MutationCtx,
  subject: string,
): Promise<Doc<"profiles"> | null> {
  const canon = canonicalAuthSubjectProfileId(subject.trim());
  const hits = await collectProfileDocsForSubjectKeys(ctx, subject);
  if (hits.length === 0) return null;
  const canonRow = hits.find((h) => h.id === canon);
  if (canonRow) return canonRow;
  hits.sort((a, b) => a._creationTime - b._creationTime);
  return hits[0] ?? null;
}
