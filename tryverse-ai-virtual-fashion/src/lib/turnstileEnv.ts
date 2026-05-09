/**
 * Cloudflare Turnstile site key from Vite (build-time); strips quotes some tooling adds around .env values.
 * Checks common names so Vercel mis-labeling still works.
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
  return "";
}
