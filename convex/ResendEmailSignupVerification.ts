/**
 * Sign-up / sign-in email OTP — used by `Password({ verify: ... })` so new accounts must
 * verify before receiving a session. Configure `AUTH_RESEND_KEY` (+ optional `AUTH_EMAIL_FROM`) on Convex.
 */
import Resend from "@auth/core/providers/resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import {
  TRYVERSE_AUTH_EMAIL_FROM,
  SIGNUP_VERIFICATION_MAX_AGE_SECONDS,
  signupVerificationEmailHtml,
  signupVerificationEmailText,
} from "./emailLayout";
import { raiseUnlessResendResponseOk } from "./resendEmailErrors";
import { trimResendSecret } from "./resendEnv";

/** Keep this id identical on the Resend() factory and export — Auth.js merge uses the factory id for stored verification rows. */
const VERIFY_PROVIDER_ID = "resend-otp-verify";

const base = Resend({
  id: VERIFY_PROVIDER_ID,
  apiKey: trimResendSecret(process.env.AUTH_RESEND_KEY),
  from:
    trimResendSecret(process.env.AUTH_EMAIL_FROM) || TRYVERSE_AUTH_EMAIL_FROM,
  maxAge: SIGNUP_VERIFICATION_MAX_AGE_SECONDS,
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
        : TRYVERSE_AUTH_EMAIL_FROM;
    const token = params.token;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Verify your email to activate TryVerse",
        text: signupVerificationEmailText(token, email),
        html: signupVerificationEmailHtml(token, email),
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
