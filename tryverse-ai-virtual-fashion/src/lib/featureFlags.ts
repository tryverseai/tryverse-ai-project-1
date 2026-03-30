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
