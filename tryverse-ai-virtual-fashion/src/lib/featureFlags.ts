/**
 * Set VITE_ENABLE_INVITE_SIGNUP=true in .env when you're ready to let approved
 * brands use /auth?signup=true (or ?invite=true) to create accounts.
 * When false: only waitlist + sign-in for existing users.
 */
export const inviteSignupEnabled = import.meta.env.VITE_ENABLE_INVITE_SIGNUP === "true";
