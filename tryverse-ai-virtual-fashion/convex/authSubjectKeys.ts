/**
 * Convex Auth `identity.subject` may be a plain user id or a compound string
 * (e.g. `accountId|userDocId`). Profile and try-on rows may use any segment as `id` / `user_id`.
 */
export function authSubjectSegments(subject: string): string[] {
  if (!subject || typeof subject !== "string") return [];
  const trimmed = subject.trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (!out.includes(p)) out.push(p);
  }
  if (!out.includes(trimmed)) out.push(trimmed);
  return out;
}

export function subjectsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const sa = new Set(authSubjectSegments(a));
  for (const x of authSubjectSegments(b)) {
    if (sa.has(x)) return true;
  }
  return false;
}
