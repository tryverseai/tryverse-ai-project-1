/**
 * Normalizes admin keys from ENV or login form: BOM/whitespace and optional
 * wrapping quotes (common when copying from `.env` examples or Railway UI).
 */
export function normalizeAdminKeyInput(raw: unknown): string {
  let s = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}
