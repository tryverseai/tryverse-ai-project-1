/** Cloudflare Turnstile site key from Vite (build-time); strips quotes some tooling adds around .env values. */
export function turnstileSiteKey(): string {
  const raw =
    typeof import.meta.env?.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY === "string"
      ? import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY
      : "";
  return raw.trim().replace(/^["']|["']$/g, "");
}
