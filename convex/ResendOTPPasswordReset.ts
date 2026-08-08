import Resend from "@auth/core/providers/resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import {
  TRYVERSE_AUTH_EMAIL_FROM,
  PASSWORD_RESET_MAX_AGE_SECONDS,
  passwordResetEmailHtml,
  passwordResetEmailText,
} from "./emailLayout";
import { raiseUnlessResendResponseOk } from "./resendEmailErrors";
import { trimResendSecret } from "./resendEnv";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

const base = Resend({
  id: "resend-otp-reset",
  apiKey: trimResendSecret(process.env.AUTH_RESEND_KEY),
  from:
    trimResendSecret(process.env.AUTH_EMAIL_FROM) || TRYVERSE_AUTH_EMAIL_FROM,
  // Without this, @auth/core's Resend provider defaults maxAge to 24 hours — far too long for
  // an 8-digit reset code. Keep in sync with PASSWORD_RESET_EXPIRY_MINUTES copy in emailLayout.ts.
  maxAge: PASSWORD_RESET_MAX_AGE_SECONDS,
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
        crypto.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
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
    // Optional only because EmailConfig's public type declares one param — @convex-dev/auth
    // always passes ctx at runtime (see signIn.js), just doesn't type it yet. Fail closed
    // (refuse to send) if that ever stops being true, rather than silently skipping the throttle.
    ctx?: ActionCtx,
  ) {
    const email = params.identifier;
    if (!ctx) throw new Error("Internal error: verification context unavailable.");
    await ctx.runMutation(internal.emailVerificationThrottle.checkAndRecordSend, { email });
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
