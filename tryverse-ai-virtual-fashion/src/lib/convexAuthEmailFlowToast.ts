/**
 * Convex Auth signup / reset wrap many failures as `[CONVEX A(auth:signIn)] … Called by client`
 * once they reach the browser. Maps those and Resend-shaped errors to actionable copy.
 */

function rawMessage(err: unknown): string {
  if (err instanceof Error) return err.message || "";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "";
  }
}

/** Client-visible wrapper from `@convex-dev/auth` actions when the nested error isn’t surfaced. */
function looksLikeConvexAuthSignInWrapper(collapsed: string): boolean {
  return (
    /\[CONVEX A\(auth:signIn\)\]/i.test(collapsed) &&
    (/Server Error/i.test(collapsed) || /Called by client/i.test(collapsed))
  );
}

const EMAIL_SETUP_HINT =
  "We couldn’t send the verification email. In Convex (dashboard.convex.dev), open your project → the deployment that matches the app’s Convex URL → Settings → Environment Variables. Add AUTH_RESEND_KEY from https://resend.com/api-keys (same pattern as backend RESEND_API_KEY). For production mail, verify your domain at resend.com/domains and set AUTH_EMAIL_FROM to TryVerse <mail@yourdomain.com>. Confirm Vercel VITE_CONVEX_URL points at that deployment (not a dev slug).";

/** Shown when submit-code fails with Convex’s opaque auth wrapper (often mis-typed/expired OTP or env mismatch). */
const VERIFY_CONVEX_WRAPPER_HINT =
  "Enter the full 8-digit code from your latest verification email (codes expire after 24 hours—request a fresh one by going back through sign up or sign in). If it still fails every time: Convex dashboard → Logs (use the Request ID from the original error if shown), verify AUTH_RESEND_KEY on the same deployment URL your site uses (VITE_CONVEX_URL on Vercel).";

function flowTitle(flow: "signup" | "password_reset" | "email_verify"): string {
  if (flow === "signup") return "Sign up failed";
  if (flow === "password_reset") return "Could not start reset";
  return "Could not verify email";
}

export function convexAuthEmailFlowToast(err: unknown, flow: "signup" | "password_reset" | "email_verify"): null | {
  title: string;
  description: string;
  variant: "default" | "destructive";
} {
  const raw = rawMessage(err);
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const low = collapsed.toLowerCase();

  const isResendTestModeOnly =
    low.includes("only send testing emails") ||
    (low.includes("resend") && low.includes("verify a domain")) ||
    (low.includes("403") && low.includes("validation_error"));

  if (isResendTestModeOnly) {
    return {
      title: "Resend is in test mode",
      description:
        "Resend can only deliver to your account email until you verify a domain at resend.com/domains and set AUTH_EMAIL_FROM on Convex to a sender on that domain.",
      variant: "default",
    };
  }

  if (
    low.includes("auth_resend_key") ||
    low.includes("resend api key is invalid") ||
    low.includes("email could not be sent")
  ) {
    const t = flowTitle(flow);
    return {
      title: t,
      description:
        raw.length < 400 && flow !== "email_verify" ? raw : flow === "email_verify" ? VERIFY_CONVEX_WRAPPER_HINT : EMAIL_SETUP_HINT,
      variant: "destructive",
    };
  }

  if (looksLikeConvexAuthSignInWrapper(collapsed)) {
    const t = flowTitle(flow);
    return {
      title: t,
      description: flow === "email_verify" ? VERIFY_CONVEX_WRAPPER_HINT : EMAIL_SETUP_HINT,
      variant: "destructive",
    };
  }

  if (/resend error:/i.test(low) || /\bresend\b.*\berror\b/i.test(low)) {
    const t = flowTitle(flow);
    return {
      title: t,
      description: flow === "email_verify" ? VERIFY_CONVEX_WRAPPER_HINT : EMAIL_SETUP_HINT,
      variant: "destructive",
    };
  }

  return null;
}
