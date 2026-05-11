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

const MAX_DETAIL_CHARS = 720;
const MAX_TOAST_TECHNICAL = 520;

function truncateForToast(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.55 ? slice.slice(0, lastSpace) : slice;
  return `${cut}…`;
}

/**
 * Convex client often wraps the real failure as `[CONVEX A(auth:signIn)] … Uncaught Error: Resend error: {...}`.
 * Pull out the inner part so toasts show the actionable message, not only generic infra copy.
 */
function extractNestedAuthFailure(collapsed: string): string | null {
  const t = collapsed.trim();
  if (!t) return null;

  const resendIdx = t.search(/\bresend\s+error:\s*/i);
  if (resendIdx >= 0) {
    const rest = t.slice(resendIdx).trim();
    if (rest.length > 0) return rest.length > MAX_DETAIL_CHARS ? `${rest.slice(0, MAX_DETAIL_CHARS - 1)}…` : rest;
  }

  const unc = /\bUncaught Error:\s*/i.exec(t);
  if (unc && unc.index !== undefined) {
    let rest = t.slice(unc.index + unc[0].length).trim();
    const atSplit = rest.split(/\s+at\s+\w/);
    rest = (atSplit[0] ?? rest).trim();
    // Drop trailing "Called by client"
    rest = rest.replace(/\s+Called by client\s*$/i, "").trim();
    if (rest.length > 8 && rest.length < MAX_DETAIL_CHARS + 80) {
      return rest.length > MAX_DETAIL_CHARS ? `${rest.slice(0, MAX_DETAIL_CHARS - 1)}…` : rest;
    }
  }

  return null;
}

const MSG_EMAIL_VERIFY_CODE =
  "That code didn’t work or may have expired. Go back, sign up or sign in again, and use the newest 8-digit code from your inbox.";

const MSG_RESET_CODE =
  "That code didn’t work or may have expired. Use Forgot password to get a new code.";

const MSG_SIGNUP_EMAIL_INFRA =
  "On the Convex Production deployment that matches your app’s VITE_CONVEX_URL, set AUTH_RESEND_KEY to your active Resend API key (same as backend RESEND_API_KEY). If it’s already set, Resend may block the recipient (sandbox / test mode) or the sender in AUTH_EMAIL_FROM.";

const SIGNUP_CONSOLE_HINT = "Open DevTools (F12) → Console; the full error is logged as a line containing TryVerse auth signup.";

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

  const nested = extractNestedAuthFailure(collapsed);

  const signupSimpleDestructive = (): { title: string; description: string; variant: "destructive" } => {
    const rawTechnical =
      nested ??
      (/\[CONVEX A\(auth/i.test(collapsed) ? truncateForToast(collapsed, MAX_TOAST_TECHNICAL) : null);
    const description = rawTechnical
      ? `Couldn’t send verification email. ${truncateForToast(rawTechnical, 480)} — ${MSG_SIGNUP_EMAIL_INFRA} ${SIGNUP_CONSOLE_HINT}`
      : `Couldn’t send verification email. ${MSG_SIGNUP_EMAIL_INFRA} ${SIGNUP_CONSOLE_HINT}`;
    return {
      title: flowTitle("signup"),
      description: truncateForToast(description, 1450),
      variant: "destructive",
    };
  };

  const resetSendSimpleDestructive = (): { title: string; description: string; variant: "destructive" } => {
    const technical = nested;
    const description = technical
      ? `${MSG_PASSWORD_RESET_EMAIL_INFRA} — ${technical}`
      : MSG_PASSWORD_RESET_EMAIL_INFRA;
    return {
      title: flowTitle("password_reset"),
      description: description.length > 900 ? `${description.slice(0, 897)}…` : description,
      variant: "destructive",
    };
  };

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
    /email could not be sent|resend is in testing mode|sending domain for auth_email_from|resend rate or quota rejected|\bresend error:/i.test(
      low,
    );
  if (useRawDescription) {
    const desc =
      nested ??
      (collapsed.length > 560 ? `${collapsed.slice(0, 557)}…` : collapsed || MSG_SIGNUP_EMAIL_INFRA);
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
