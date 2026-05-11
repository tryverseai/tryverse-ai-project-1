/**
 * Sign-up / sign-in email OTP — used by `Password({ verify: ... })` so new accounts must
 * verify before receiving a session. Configure `AUTH_RESEND_KEY` (+ optional `AUTH_EMAIL_FROM`) on Convex.
 */
import Resend from "@auth/core/providers/resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { raiseUnlessResendResponseOk } from "./resendEmailErrors";
import { trimResendSecret } from "./resendEnv";

/** Keep this id identical on the Resend() factory and export — Auth.js merge uses the factory id for stored verification rows. */
const VERIFY_PROVIDER_ID = "resend-otp-verify";

const base = Resend({
  id: VERIFY_PROVIDER_ID,
  apiKey: trimResendSecret(process.env.AUTH_RESEND_KEY),
  from:
    trimResendSecret(process.env.AUTH_EMAIL_FROM) || "TryVerse <onboarding@resend.dev>",
});

const baseOpts =
  base && typeof base === "object" && "options" in base && (base as { options?: Record<string, unknown> }).options
    ? ((base as { options: Record<string, unknown> }).options as Record<string, unknown>)
    : {};

/**
 * Must use a different provider `id` than password reset (`resend-otp-reset`).
 * Convex Auth merges `provider` with `provider.options`; `options.id` wins over top-level `id`.
 */
export const ResendEmailSignupVerification = {
  ...base,
  id: VERIFY_PROVIDER_ID,
  options: { ...baseOpts, id: VERIFY_PROVIDER_ID },
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 8);
  },
  async sendVerificationRequest(
    params: {
      identifier: string;
      url: string;
      expires: Date;
      provider: typeof base & { apiKey?: string; from?: string };
      token: string;
      theme: unknown;
      request: Request;
    },
  ) {
    const email = params.identifier;
    const apiKey = trimResendSecret(params.provider.apiKey as string | undefined);
    if (!apiKey) {
      throw new Error("AUTH_RESEND_KEY is not set in Convex environment variables.");
    }
    const from =
      typeof params.provider.from === "string" && trimResendSecret(params.provider.from).length > 0
        ? trimResendSecret(params.provider.from)
        : "TryVerse <onboarding@resend.dev>";
    const token = params.token;
    const textBody =
      `Welcome to TryVerse.\n\n` +
      `Your verification code is ${token}. Open the app, go to the “Verify email” step after sign-up, and enter this code to finish setting up your account.\n\n` +
      `This code expires in 24 hours. If you did not create an account, you can ignore this email.`;
    const htmlBody = `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:520px">
  <h1 style="font-size:22px;margin:0 0 12px">Welcome to TryVerse</h1>
  <p style="margin:0 0 16px">Thanks for signing up. Enter this code on the verify-email screen to confirm your address and continue:</p>
  <p style="font-size:28px;letter-spacing:0.25em;font-weight:700;margin:20px 0">${token}</p>
  <p style="margin:0;font-size:14px;color:#555">This code expires in 24 hours. If you didn’t create an account, you can ignore this message.</p>
</body>
</html>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Welcome to TryVerse — verify your email",
        text: textBody,
        html: htmlBody,
      }),
    });
    if (!res.ok) {
      let detail: string;
      let parsed: unknown;
      try {
        parsed = await res.json();
        detail = JSON.stringify(parsed);
      } catch {
        parsed = undefined;
        detail = await res.text();
      }
      raiseUnlessResendResponseOk(res, detail, parsed);
    }
  },
};

/**
 * Older deployments stored verification rows under this id. Kept on the main
 * `convexAuth({ providers })` list so OTP verification works for those rows.
 */
const LEGACY_VERIFY_ID = "resend-email-verify";

const signupVerifyOpts =
  "options" in ResendEmailSignupVerification &&
  ResendEmailSignupVerification.options &&
  typeof ResendEmailSignupVerification.options === "object"
    ? (ResendEmailSignupVerification.options as Record<string, unknown>)
    : {};

export const ResendEmailSignupVerificationLegacy = {
  ...ResendEmailSignupVerification,
  id: LEGACY_VERIFY_ID,
  options: { ...signupVerifyOpts, id: LEGACY_VERIFY_ID },
};
