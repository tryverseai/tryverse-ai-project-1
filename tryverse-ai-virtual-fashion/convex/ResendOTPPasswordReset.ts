import Resend from "@auth/core/providers/resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

const base = Resend({
  id: "resend-otp-reset",
  apiKey: process.env.AUTH_RESEND_KEY ?? "",
  from: process.env.AUTH_EMAIL_FROM ?? "TryVerse <onboarding@resend.dev>",
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
    const apiKey = params.provider.apiKey as string;
    if (!apiKey) {
      throw new Error("AUTH_RESEND_KEY is not set in Convex environment variables.");
    }
    const from =
      typeof params.provider.from === "string" && params.provider.from.length > 0
        ? params.provider.from
        : "TryVerse <onboarding@resend.dev>";
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
        text:
          `Your password reset code is ${token}. Enter it on the TryVerse reset password page along with your new password.\n\n` +
          `This code expires in 24 hours. If you did not request a reset, ignore this email.`,
      }),
    });
    if (!res.ok) {
      let detail: string;
      try {
        detail = JSON.stringify(await res.json());
      } catch {
        detail = await res.text();
      }
      throw new Error(`Resend error: ${detail}`);
    }
  },
};
