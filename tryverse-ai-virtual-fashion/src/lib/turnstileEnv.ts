/** Cloudflare's official always-passes test key for local development. */
const TURNSTILE_DEV_TEST_KEY = "1x00000000000000000000AA";

/**
 * Cloudflare Turnstile site key from Vite (build-time); strips quotes some tooling adds around .env values.
 * In development, falls back to Cloudflare's always-passes test key when unset.
 * Production: set VITE_CLOUDFLARE_TURNSTILE_SITE_KEY to your real key from dash.cloudflare.com.
 */
export function turnstileSiteKey(): string {
  const candidates = [
    import.meta.env?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY,
    import.meta.env?.VITE_TURNSTILE_SITE_KEY,
    import.meta.env?.VITE_CF_TURNSTILE_SITE_KEY,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim() !== "") {
      return c.trim().replace(/^["']|["']$/g, "");
    }
  }
  if (import.meta.env.DEV) return TURNSTILE_DEV_TEST_KEY;
  return "";
}
