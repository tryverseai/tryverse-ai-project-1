/**
 * FASHN AI's generated-output CDN hostnames. FASHN migrated from `cdn.fashn.ai` to
 * `media.fashn.ai` on 2026-09-02T00:00:00Z; both are kept trusted indefinitely since
 * predictions created before the migration can still resolve to the old host, and FASHN's own
 * announcement gave no hard cutoff for `cdn.fashn.ai` ceasing to resolve.
 *
 * This is an exact-match allowlist (not a suffix/subdomain check) — deliberately so a lookalike
 * like `cdn.fashn.ai.evil.com` or `evilcdn.fashn.ai` cannot pass by sharing a substring with a
 * trusted host. Add a new host here only when FASHN documents it, never inferred from a URL seen
 * at runtime.
 */
export const TRUSTED_FASHN_OUTPUT_HOSTS: ReadonlySet<string> = new Set([
  'cdn.fashn.ai',
  'media.fashn.ai',
]);

export function isTrustedFashnOutputHost(hostname: string): boolean {
  return TRUSTED_FASHN_OUTPUT_HOSTS.has(hostname.trim().toLowerCase());
}
