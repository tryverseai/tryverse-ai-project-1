/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "true", public signup is invite-only (navbar + /auth gate). */
  readonly VITE_INVITE_ONLY_MODE?: string;
  /** @deprecated Legacy alias for VITE_INVITE_ONLY_MODE — prefer INVITE_ONLY_MODE. */
  readonly VITE_INVITE_ONLY_ACCESS?: string;
  /** Calendly embed URL for /book-demo (optional). */
  readonly VITE_CALENDLY_URL?: string;
  /** Set to "false" to block brand self-serve signup (default: allowed). */
  readonly VITE_ENABLE_INVITE_SIGNUP?: string;
  /** Set to "false" to block /auth?signup=individual (default: personal sign-up allowed). */
  readonly VITE_ENABLE_B2C_SIGNUP?: string;
  /** Cloudflare Turnstile site key — shows widget on /auth when set. */
  readonly VITE_CLOUDFLARE_TURNSTILE_SITE_KEY?: string;
}

declare module "*.mp4" {
  const src: string;
  export default src;
}
