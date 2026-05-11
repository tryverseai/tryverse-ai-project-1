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

export function convexAuthEmailFlowToast(err: unknown, flow: "signup" | "password_reset"): null | {
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
    return {
      title: flow === "signup" ? "Sign up failed" : "Could not start reset",
      description: raw.length < 400 ? raw : EMAIL_SETUP_HINT,
      variant: "destructive",
    };
  }

  if (looksLikeConvexAuthSignInWrapper(collapsed)) {
    return {
      title: flow === "signup" ? "Sign up failed" : "Could not start reset",
      description: EMAIL_SETUP_HINT,
      variant: "destructive",
    };
  }

  if (/resend error:/i.test(low) || /\bresend\b.*\berror\b/i.test(low)) {
    return {
      title: flow === "signup" ? "Sign up failed" : "Could not start reset",
      description: EMAIL_SETUP_HINT,
      variant: "destructive",
    };
  }

  return null;
}
