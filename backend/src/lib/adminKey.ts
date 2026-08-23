import { timingSafeEqual } from 'crypto';

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

/**
 * Constant-time string equality for admin secret checks \u2014 `ADMIN_SECRET_KEY` gates the entire
 * admin console, so a plain `===`/`!==` compare (which short-circuits on the first differing
 * byte) is a real timing side-channel over enough requests. `crypto.timingSafeEqual` throws on
 * mismatched buffer lengths rather than returning false, so a length mismatch is handled as an
 * explicit reject before it ever reaches that call \u2014 length alone isn't the secret here, and this
 * avoids leaking timing based on how the throw path differs from the compare path.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
