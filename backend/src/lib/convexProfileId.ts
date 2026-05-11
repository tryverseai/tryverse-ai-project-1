/**
 * Convex Auth JWT `subject` may be a plain user id or compound `accountId|userDocId`.
 * Storing profiles under the compound string on one session and only `userDocId` on another
 * creates duplicate profiles. Always use the canonical id for `profiles.id` writes.
 */
export function canonicalConvexProfileUserId(subject: string): string {
  const trimmed = String(subject ?? '').trim();
  if (!trimmed) return trimmed;
  const parts = trimmed
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return parts[parts.length - 1]!;
  }
  return trimmed;
}
