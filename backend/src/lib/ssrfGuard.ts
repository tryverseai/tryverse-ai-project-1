/**
 * Shared SSRF hostname guard — used everywhere the backend fetches a URL that could be influenced
 * by a user or brand (product image URLs, "/from-url" uploads, model-library image URLs, FASHN
 * result URLs). Was previously duplicated as an identical regex in 4 separate files; centralized
 * here after a security review found the duplicated pattern missed two real bypasses:
 *
 *  - IPv4-mapped IPv6 literals (`[::ffff:127.0.0.1]`, `[::ffff:169.254.169.254]`) — these route to
 *    the mapped IPv4 address at the OS/network level but didn't match any of the IPv4-only regex
 *    alternatives, so `http://[::ffff:169.254.169.254]/` reached a cloud metadata endpoint despite
 *    `169\.254\.` being explicitly blocked for the plain-IPv4 form.
 *  - Private IPv6 ranges beyond the literal loopback/unspecified addresses: unique-local
 *    (`fc00::/7`) and link-local (`fe80::/10`) were not covered at all.
 *
 * Residual, structurally-hard risk this does NOT close (documented, not silently ignored): this
 * validates the hostname *string* at check time, then the caller's own `fetch()` performs an
 * independent DNS resolution — there is no IP-pinning between the check and the actual connect.
 * A DNS-rebinding attack (a domain resolving to a public IP when this check runs, then a private/
 * internal IP when the TCP connection is made moments later) is not prevented by a string-level
 * hostname check. Closing that fully would require a custom resolver/agent that resolves once and
 * connects to the pinned IP — a larger change, out of scope for this pass.
 */
const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  // IPv6 loopback / unspecified, bracketed or not (new URL().hostname keeps brackets for IPv6).
  /^\[?::1\]?$/,
  /^\[?::\]?$/,
  // IPv4-mapped IPv6 literals — route to the mapped IPv4 address at connect time.
  /^\[?::ffff:127\./i,
  /^\[?::ffff:0\./i,
  /^\[?::ffff:10\./i,
  /^\[?::ffff:172\.(1[6-9]|2[0-9]|3[01])\./i,
  /^\[?::ffff:192\.168\./i,
  /^\[?::ffff:169\.254\./i,
  // Unique-local (fc00::/7 — first byte fc or fd) and link-local (fe80::/10) IPv6 ranges.
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^\[?fe[89ab][0-9a-f]:/i,
];

export function isPrivateOrBlockedHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase();
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(h));
}
