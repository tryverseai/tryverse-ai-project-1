/**
 * Convex Auth often bubbles failures as `[CONVEX A(auth:signIn)] … Called by client`.
 * Map those to short, actionable copy. Always log the raw message (truncated) so deployers
 * can see the real cause in the browser console.
 */

export type AuthEmailFlow = "signup" | "password_reset" | "email_verify" | "reset_verify";

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message || "";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "";
  }
}

function looksLikeConvexAuthSignInWrapper(collapsed: string): boolean {
  return (
    /\[CONVEX A\(auth:signIn\)\]/i.test(collapsed) &&
    (/Server Error/i.test(collapsed) || /Called by client/i.test(collapsed))
  );
}

const MSG_EMAIL_VERIFY_CODE =
  "That code didn’t work or may have expired. Go back, sign up or sign in again, and use the newest 8-digit code from your inbox.";

const MSG_RESET_CODE =
  "That code didn’t work or may have expired. Use Forgot password to get a new code.";

/** Shown when Convex strips details but the failure is almost always email / Resend config. */
const MSG_SIGNUP_EMAIL_INFRA =
  "We couldn’t send your verification email. Set AUTH_RESEND_KEY on your Convex deployment to the active API key from resend.com (the same RESEND_API_KEY you use on the backend). For a custom “from” address, verify your domain at Resend and set AUTH_EMAIL_FROM. Open DevTools Console for “[TryVerse auth:signup]…” with the technical message.";

const MSG_PASSWORD_RESET_EMAIL_INFRA =
  "We couldn’t send the reset-code email. Set AUTH_RESEND_KEY on Convex to your active Resend key (same as backend RESEND_API_KEY). Check DevTools Console for “[TryVerse auth:password_reset]…”.";

const MSG_RESET_SIMPLE =
  "We couldn’t send a reset code—usually AUTH_RESEND_KEY or sender domain setup on Convex. Retry in a moment or check Convex + Resend settings.";

const MSG_RESEND_TEST_SIMPLE =
  "This address can’t receive our messages yet. Try a different email or contact support.";

const MSG_NO_AUTH_RESEND_KEY =
  "Verification email isn’t configured: add AUTH_RESEND_KEY in the Convex dashboard (Project → Settings → Environment Variables for the deployment your app uses). Use the same Resend API key as backend RESEND_API_KEY. Redeploy Convex functions after saving.";

function flowTitle(flow: AuthEmailFlow): string {
  if (flow === "signup") return "Sign up failed";
  if (flow === "password_reset") return "Couldn’t send reset email";
  if (flow === "reset_verify") return "Couldn’t reset password";
  return "Couldn’t verify email";
}

function pickCodeFailure(flow: AuthEmailFlow): {
  title: string;
  description: string;
  variant: "destructive";
} {
  if (flow === "reset_verify") {
    return { title: flowTitle("reset_verify"), description: MSG_RESET_CODE, variant: "destructive" };
  }
  return { title: flowTitle("email_verify"), description: MSG_EMAIL_VERIFY_CODE, variant: "destructive" };
}

export function convexAuthEmailFlowToast(err: unknown, flow: AuthEmailFlow): null | {
  title: string;
  description: string;
  variant: "default" | "destructive";
} {
  const raw = rawMessage(err);
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const low = collapsed.toLowerCase();

  if (raw) {
    console.warn(`[TryVerse auth:${flow}]`, collapsed.length > 1200 ? `${collapsed.slice(0, 1200)}…` : collapsed);
  }

  const signupSimpleDestructive = (): { title: string; description: string; variant: "destructive" } => ({
    title: flowTitle("signup"),
    description: MSG_SIGNUP_EMAIL_INFRA,
    variant: "destructive",
  });

  const resetSendSimpleDestructive = (): { title: string; description: string; variant: "destructive" } => ({
    title: flowTitle("password_reset"),
    description: MSG_PASSWORD_RESET_EMAIL_INFRA,
    variant: "destructive",
  });

  const isResendTestModeOnly =
    low.includes("only send testing emails") ||
    low.includes("you can only send testing emails") ||
    low.includes("resend is in testing mode") ||
    (low.includes("resend") && low.includes("verify a domain")) ||
    (low.includes("403") && low.includes("validation_error"));

  if (
    low.includes("auth_resend_key") &&
    (low.includes("not set") || low.includes("environment variables"))
  ) {
    if (flow === "email_verify" || flow === "reset_verify") return pickCodeFailure(flow);
    if (flow === "password_reset") {
      return { title: flowTitle("password_reset"), description: MSG_NO_AUTH_RESEND_KEY, variant: "destructive" };
    }
    return { title: flowTitle("signup"), description: MSG_NO_AUTH_RESEND_KEY, variant: "destructive" };
  }

  /** Server surfaced a full Resend / config explanation — prefer it verbatim in the toast */
  const useRawDescription =
    /email could not be sent|resend is in testing mode|sending domain for auth_email_from|resend rate or quota rejected/i.test(
      low,
    );
  if (useRawDescription) {
    const desc =
      collapsed.length > 560 ? `${collapsed.slice(0, 557)}…` : collapsed || MSG_SIGNUP_EMAIL_INFRA;
    if (flow === "password_reset") {
      return { title: flowTitle("password_reset"), description: desc, variant: "destructive" };
    }
    if (flow === "signup") {
      return { title: flowTitle("signup"), description: desc, variant: "destructive" };
    }
    if (flow === "reset_verify") {
      return { title: flowTitle("reset_verify"), description: MSG_RESET_SIMPLE, variant: "destructive" };
    }
    return { title: flowTitle("email_verify"), description: MSG_EMAIL_VERIFY_CODE, variant: "destructive" };
  }

  if (isResendTestModeOnly) {
    if (flow === "email_verify" || flow === "reset_verify") return pickCodeFailure(flow);
    if (flow === "password_reset") {
      return { title: flowTitle("password_reset"), description: MSG_RESEND_TEST_SIMPLE, variant: "default" };
    }
    return {
      title: flowTitle("signup"),
      description: MSG_RESEND_TEST_SIMPLE,
      variant: "default",
    };
  }

  if (
    low.includes("auth_resend_key") ||
    low.includes("resend api key is invalid") ||
    low.includes("email could not be sent") ||
    looksLikeConvexAuthSignInWrapper(collapsed) ||
    /resend error:/i.test(low) ||
    /\bresend\b.*\berror\b/i.test(low)
  ) {
    if (flow === "email_verify" || flow === "reset_verify") return pickCodeFailure(flow);
    if (flow === "password_reset") return resetSendSimpleDestructive();
    return signupSimpleDestructive();
  }

  if (
    /\[CONVEX A\(auth:?/i.test(collapsed) ||
    (/\bconvex\b/i.test(low) && (/request\s*id|server\s*error|called\s*by\s*client/i.test(low) || /auth[:\s]/i.test(collapsed)))
  ) {
    if (flow === "email_verify" || flow === "reset_verify") return pickCodeFailure(flow);
    if (flow === "password_reset") return resetSendSimpleDestructive();
    return signupSimpleDestructive();
  }

  /**
   * Convex Auth / client sometimes surfaces only this line (e.g. email send or auth action failed server-side).
   */
  if (
    (flow === "signup" || flow === "password_reset") &&
    /\bauthentication\s+service\s+error\b/i.test(low)
  ) {
    if (flow === "password_reset") {
      return {
        title: flowTitle("password_reset"),
        description: MSG_PASSWORD_RESET_EMAIL_INFRA,
        variant: "destructive",
      };
    }
    return signupSimpleDestructive();
  }

  return null;
}
