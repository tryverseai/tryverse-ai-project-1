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
  /** Set to "true" to show the Outfit Builder dashboard tab (Enterprise-gated, default: hidden). */
  readonly VITE_OUTFIT_BUILDER_ENABLED?: string;
  /** Set to "true" to show the AI Model Studio dashboard tab (Enterprise-gated, default: hidden). */
  readonly VITE_PRODUCT_MODEL_ENABLED?: string;
  /** Set to "true" to show the AI Video dashboard tab (Enterprise-gated, default: hidden). */
  readonly VITE_VIDEO_ENABLED?: string;
}

declare module "*.mp4" {
  const src: string;
  export default src;
}
