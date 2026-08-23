/**
 * Constant-time string equality. Convex functions run in a V8 isolate without `node:crypto`
 * (short of opting a whole file into `"use node"`, which trades away Convex's isolate
 * performance/cold-start characteristics for every function in that file — too heavy for
 * `backendTrusted.ts`/`adminTrusted.ts`, which are large and called on nearly every request), so
 * this is a plain-JS constant-time comparison rather than `crypto.timingSafeEqual`.
 *
 * Always walks every character of both strings regardless of where they first differ, and always
 * compares the same fixed number of characters (the longer of the two lengths) — a length
 * mismatch is folded into the same byte-by-byte loop instead of short-circuiting. Guards against
 * timing attacks recovering `BACKEND_SHARED_SECRET`/`ADMIN_SECRET_KEY` byte-by-byte from response
 * latency, which matters here specifically because these secrets gate the entire trust boundary
 * between the Express backend and every `backendTrusted`/`adminTrusted` Convex function.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/** Shared secret check used by every `backendTrusted`/`adminTrusted`/`invites`/`trustedStorage` function. */
export function requireBackendSecret(secret: string): void {
  const expected = (process.env.BACKEND_SHARED_SECRET ?? "").trim();
  const got = String(secret).trim();
  if (!expected || !constantTimeEqual(got, expected)) {
    throw new Error("Unauthorized");
  }
}
