/**
 * Brand (B2B) self-serve signup from /auth?signup=business (or ?signup=true / ?invite=true).
 * Allowed by default. Set VITE_ENABLE_INVITE_SIGNUP=false to block new business sign-ups
 * (waitlist + existing sign-in only).
 */
export const inviteSignupEnabled = import.meta.env.VITE_ENABLE_INVITE_SIGNUP !== "false";

/**
 * Personal (B2C) accounts: /auth?signup=individual
 * Set VITE_ENABLE_B2C_SIGNUP=false to pause consumer registration.
 */
export const b2cSignupEnabled = import.meta.env.VITE_ENABLE_B2C_SIGNUP !== "false";

/**
 * Pre-launch UI: emphasize invite / demo CTAs in the shell; does not block /auth?signup=* create-account forms
 * (beta approval is enforced after signup). Set VITE_INVITE_ONLY_MODE=true (or legacy VITE_INVITE_ONLY_ACCESS=true).
 */
export const FEATURE_FLAGS = {
  /** Also accepts legacy typo `VITE_INVITE_ONLY_ACCESS` if set to "true". */
  INVITE_ONLY_MODE:
    import.meta.env.VITE_INVITE_ONLY_MODE === "true" ||
    import.meta.env.VITE_INVITE_ONLY_ACCESS === "true",
  /**
   * Outfit Builder (multi-product flat-lay try-on via FASHN Try-On Max) — launched, credit-metered
   * on all plans server-side. Defaults on; set VITE_OUTFIT_BUILDER_ENABLED=false as an emergency
   * kill switch only (this used to default off as a dark-ship flag — none of these three flags
   * were ever set in Vercel production, so the feature was silently showing "Coming soon" to every
   * real user despite being fully live on the backend).
   */
  OUTFIT_BUILDER_ENABLED: import.meta.env.VITE_OUTFIT_BUILDER_ENABLED !== "false",
  /** Product Photography (FASHN product-to-model) — launched; same kill-switch pattern as above. */
  PRODUCT_MODEL_ENABLED: import.meta.env.VITE_PRODUCT_MODEL_ENABLED !== "false",
  /** AI Video (FASHN image-to-video, real per-credit cost) — launched; same kill-switch pattern. */
  VIDEO_ENABLED: import.meta.env.VITE_VIDEO_ENABLED !== "false",
} as const;
