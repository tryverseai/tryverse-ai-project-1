import { convexAuth } from "@convex-dev/auth/server";
import {
  ResendEmailSignupVerification,
  ResendEmailSignupVerificationLegacy,
} from "./ResendEmailSignupVerification";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";
import { TryVersePassword } from "./tryVersePassword";

/**
 * Session/token TTL. Previously unset entirely, so every value silently fell back to
 * @convex-dev/auth's library defaults: `session.totalDurationMs` = 30 days, `session.
 * inactiveDurationMs` = 30 days, `jwt.durationMs` = 1 hour. Since a 30-day-inactive refresh token
 * renews itself (a fresh `inactiveDurationMs` window) on every use, any account opened at least
 * once a month stayed signed in indefinitely — the literal "logged in for days" bug — with no
 * explicit policy actually chosen anywhere in this codebase.
 *
 * `totalDurationMs` / `inactiveDurationMs` are enforced by Convex Auth itself at refresh time
 * against the server-side `authSessions` / `authRefreshTokens` tables (see
 * node_modules/@convex-dev/auth/dist/server/implementation/{sessions,refreshTokens}.js) — this is
 * the authoritative layer, not a client-side timer. `jwt.durationMs` bounds a separate residual
 * risk: `verifyBearerSession` (convex/authSession.ts), which every Express `requireAuth` request
 * calls, verifies the JWT's own signature + expiry only — it does not re-check the live session
 * record per request — so an already-issued access token keeps authenticating on its own until it
 * expires, even if the underlying session ended sooner. Shortening it from the 1-hour default
 * bounds that window without adding a new per-request database lookup; the client refreshes the
 * token silently in the background well before it expires, so normal use is unaffected.
 *
 * The separate 15-minute client-side idle timer (`useIdleSessionLogout`) is a UX nicety for an
 * abandoned open tab, layered on top of this — it is not, and must not be treated as, the
 * enforcement boundary.
 */
// Exported so convex/auth.test.ts can assert on the actual configured policy — a regression guard
// against these silently drifting back to "unset" (which is exactly how this bug happened once).
export const SESSION_TOTAL_DURATION_MS = 24 * 60 * 60 * 1000; // 24h — hard ceiling regardless of activity
export const SESSION_INACTIVE_DURATION_MS = 4 * 60 * 60 * 1000; // 4h — expires sooner if never refreshed
export const JWT_DURATION_MS = 15 * 60 * 1000; // 15min — bounds residual access-token life after sign-out

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  session: {
    totalDurationMs: SESSION_TOTAL_DURATION_MS,
    inactiveDurationMs: SESSION_INACTIVE_DURATION_MS,
  },
  jwt: {
    durationMs: JWT_DURATION_MS,
  },
  providers: [
    TryVersePassword({
      reset: ResendOTPPasswordReset,
      verify: ResendEmailSignupVerification,
      validatePasswordRequirements(password: string) {
        if (!password || password.length < 10) {
          throw new Error("Password must be at least 10 characters.");
        }
      },
      profile(params) {
        // TryVerse is B2B-only — every account is a "business" account.
        const email = String(params.email ?? "").trim();
        const flow = String(params.flow ?? "");
        const brandName = params.brandName != null ? String(params.brandName).trim() : "";
        const fullName = params.fullName != null ? String(params.fullName).trim() : "";
        const role = params.role != null ? String(params.role).trim() : "";
        const displayName =
          flow === "signUp"
            ? brandName || fullName || email.split("@")[0]!
            : email.split("@")[0]!;
        const base: Record<string, string> & { email: string } = {
          email,
          name: displayName,
          account_type: "business",
        };
        if (brandName !== "") base["brand_name"] = brandName;
        if (fullName !== "") base["full_name"] = fullName;
        if (role !== "") base["role"] = role;
        return base;
      },
    }),
    ResendEmailSignupVerificationLegacy,
  ],
});
