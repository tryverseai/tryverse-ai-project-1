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
   * Outfit Builder (multi-product flat-lay try-on via FASHN Try-On Max) — a second, deliberate
   * safety layer on top of the server-side Enterprise plan gate. Defaults off so the feature can
   * be dark-shipped and tested before it's ever shown to a real brand. Set VITE_OUTFIT_BUILDER_ENABLED=true
   * to turn it on.
   */
  OUTFIT_BUILDER_ENABLED: import.meta.env.VITE_OUTFIT_BUILDER_ENABLED === "true",
} as const;
