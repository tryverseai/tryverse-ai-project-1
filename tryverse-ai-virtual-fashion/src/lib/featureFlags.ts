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
 * Pre-launch: public signup hidden; navbar + /auth show waitlist / demo CTAs; signup only via /auth/invite/:token.
 * Vite: set VITE_INVITE_ONLY_MODE=true (not NEXT_PUBLIC_*).
 * When false, all invite-only UI gates are off.
 */
export const FEATURE_FLAGS = {
  /** Also accepts legacy typo `VITE_INVITE_ONLY_ACCESS` if set to "true". */
  INVITE_ONLY_MODE:
    import.meta.env.VITE_INVITE_ONLY_MODE === "true" ||
    import.meta.env.VITE_INVITE_ONLY_ACCESS === "true",
} as const;
