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

/**
 * All distinct subject strings that Convex may have used as `profiles.id` / legacy `tryons.user_id`.
 * Mirrors `convex/authSubjectKeys.ts`.
 */
export function authSubjectSegments(subject: string): string[] {
  if (!subject || typeof subject !== 'string') return [];
  const trimmed = subject.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (!out.includes(p)) out.push(p);
  }
  if (!out.includes(trimmed)) out.push(trimmed);
  return out;
}
