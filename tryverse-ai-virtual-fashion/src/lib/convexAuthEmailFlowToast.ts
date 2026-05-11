/**
 * Convex Auth often bubbles failures as `[CONVEX A(auth:signIn)] … Called by client`.
 * Map those to short, non-technical copy for end users. Log raw messages in DEV only.
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

const MSG_SIGNUP_SIMPLE =
  "We couldn’t finish sign-up. Please try again. If this keeps happening, contact support.";

const MSG_RESET_SIMPLE = "We couldn’t send a reset code. Please try again in a moment or contact support.";

const MSG_RESEND_TEST_SIMPLE =
  "This address can’t receive our messages yet. Try a different email or contact support.";

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

  if (import.meta.env.DEV && raw) {
    console.warn(`[TryVerse auth:${flow}]`, raw);
  }

  const signupSimpleDestructive = (): { title: string; description: string; variant: "destructive" } => ({
    title: flowTitle("signup"),
    description: MSG_SIGNUP_SIMPLE,
    variant: "destructive",
  });

  const resetSendSimpleDestructive = (): { title: string; description: string; variant: "destructive" } => ({
    title: flowTitle("password_reset"),
    description: MSG_RESET_SIMPLE,
    variant: "destructive",
  });

  const isResendTestModeOnly =
    low.includes("only send testing emails") ||
    (low.includes("resend") && low.includes("verify a domain")) ||
    (low.includes("403") && low.includes("validation_error"));

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
    if (flow === "password_reset") return resetSendSimpleDestructive();
    return signupSimpleDestructive();
  }

  return null;
}
