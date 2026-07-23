import Resend from "@auth/core/providers/resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import {
  TRYVERSE_AUTH_EMAIL_FROM,
  passwordResetEmailHtml,
  passwordResetEmailText,
} from "./emailLayout";
import { raiseUnlessResendResponseOk } from "./resendEmailErrors";
import { trimResendSecret } from "./resendEnv";

const base = Resend({
  id: "resend-otp-reset",
  apiKey: trimResendSecret(process.env.AUTH_RESEND_KEY),
  from:
    trimResendSecret(process.env.AUTH_EMAIL_FROM) || TRYVERSE_AUTH_EMAIL_FROM,
});

/**
 * 8-digit OTP for password reset (see labs.convex.dev/auth/config/passwords).
 * Convex dashboard: AUTH_RESEND_KEY (required). Optional: AUTH_EMAIL_FROM (verified domain in Resend).
 */
export const ResendOTPPasswordReset = {
  ...base,
  id: "resend-otp-reset",
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
        subject: "Reset your TryVerse password",
        text: passwordResetEmailText(token),
        html: passwordResetEmailHtml(token),
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
