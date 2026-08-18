/**
 * Branded HTML layout for Convex Auth transactional emails (Resend).
 * Mirrors backend/src/services/email/layout.ts — presentation only.
 */

export const TRYVERSE_LOGO_URL = "https://tryverseai.com/tryverse-logo.png";
export const TRYVERSE_APP_URL = "https://tryverseai.com";
export const TRYVERSE_CONTACT_EMAIL = "info@tryverseai.com";

/** Branded sender — display name "TryVerse AI" */
export const TRYVERSE_AUTH_EMAIL_FROM = "TryVerse AI <info@tryverseai.com>";

/** Sign-up verification OTP TTL — must match maxAge on ResendEmailSignupVerification. */
export const SIGNUP_VERIFICATION_MAX_AGE_SECONDS = 60 * 15;
export const SIGNUP_VERIFICATION_EXPIRY_MINUTES = SIGNUP_VERIFICATION_MAX_AGE_SECONDS / 60;

/**
 * Password reset OTP TTL — must match maxAge on ResendOTPPasswordReset.
 * Previously unset, so it silently inherited @auth/core's Resend provider default of 24 hours —
 * far too long for an 8-digit code and a common source of "why did my code still work / why did
 * it expire on me" confusion. Matches the sign-up code's 15-minute window.
 */
export const PASSWORD_RESET_MAX_AGE_SECONDS = 60 * 15;
export const PASSWORD_RESET_EXPIRY_MINUTES = PASSWORD_RESET_MAX_AGE_SECONDS / 60;

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function renderVerificationCodeBlock(code: string): string {
  const safe = escapeHtml(code.trim());
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td align="center" style="background-color:#f8f8f9;border:1px solid #e8e8ea;border-radius:12px;padding:32px 24px;">
        <p style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#888888;">Verification code</p>
        <p style="margin:0;font-size:40px;font-weight:700;letter-spacing:0.32em;color:#000000;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;line-height:1.2;">${safe}</p>
      </td>
    </tr>
  </table>`;
}

export function renderBulletList(items: string[]): string {
  const lis = items
    .map(
      (item) =>
        `<tr><td style="padding:4px 0;vertical-align:top;width:20px;color:#888888;">&bull;</td><td style="padding:4px 0 4px 8px;color:#3d3d3d;">${escapeHtml(item)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 8px;width:100%;">${lis}</table>`;
}

export function renderBrandedEmail(params: {
  headline: string;
  bodyHtml: string;
  cta?: { label: string; href: string };
  closingLine?: string;
}): string {
  const { headline, bodyHtml, cta, closingLine } = params;
  const safeHeadline = escapeHtml(headline);
  const ctaBlock = cta
    ? `<tr>
        <td align="center" style="padding:8px 32px 32px;">
          <a href="${escapeHtml(cta.href)}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;padding:14px 32px;background-color:#000000;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.01em;mso-padding-alt:0;">
            <!--[if mso]><i style="letter-spacing:25px;mso-font-width:-100%;mso-text-raise:30pt">&nbsp;</i><![endif]-->
            <span style="color:#ffffff;">${escapeHtml(cta.label)}</span>
            <!--[if mso]><i style="letter-spacing:25px;mso-font-width:-100%">&nbsp;</i><![endif]-->
          </a>
        </td>
      </tr>`
    : "";
  const closingBlock = closingLine
    ? `<tr>
        <td style="padding:0 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;">
          <p style="margin:24px 0 0;">${escapeHtml(closingLine)}</p>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeHeadline}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e8ea;">
          <tr>
            <td align="center" style="padding:36px 32px 24px;">
              <a href="${TRYVERSE_APP_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:10px;">
                  <tr>
                    <td style="padding:12px 20px;">
                      <img src="${TRYVERSE_LOGO_URL}" alt="TryVerse AI" width="140" height="auto"
                           style="display:block;border:0;outline:none;text-decoration:none;max-width:140px;height:auto;margin:0 auto;" />
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <h1 style="margin:0;font-size:22px;font-weight:700;line-height:1.35;color:#000000;letter-spacing:-0.02em;text-align:center;">${safeHeadline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3d3d3d;">
              ${bodyHtml}
            </td>
          </tr>
          ${ctaBlock}
          ${closingBlock}
          <tr>
            <td style="padding:16px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3d3d3d;">
              <p style="margin:0;">&mdash;<br/>The TryVerse Team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e8e8ea;margin:0;" /></td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#888888;">
              <p style="margin:0 0 4px;font-weight:600;color:#666666;">TryVerse AI</p>
              <p style="margin:0 0 12px;">AI Infrastructure for Fashion Visualization</p>
              <p style="margin:0;">
                <a href="${TRYVERSE_APP_URL}" style="color:#666666;text-decoration:underline;">tryverseai.com</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:${TRYVERSE_CONTACT_EMAIL}" style="color:#666666;text-decoration:underline;">${TRYVERSE_CONTACT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Sign-up email verification OTP — premium fashion-tech tone. */
export function signupVerificationEmailHtml(token: string, email?: string): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;">Welcome to TryVerse.</p>
    <p style="margin:0 0 16px;">You&rsquo;re one step away from activating your workspace. Enter the verification code below on the verify-email screen to confirm your address and unlock your account.</p>
    ${renderVerificationCodeBlock(token)}
    <p style="margin:0;font-size:14px;color:#888888;line-height:1.6;">This verification code expires in ${SIGNUP_VERIFICATION_EXPIRY_MINUTES} minutes. If it expires before you enter it, just start signing up again with the same email and password — we'll send a fresh code. If you did not create an account, you can safely ignore this email.</p>`;
  return renderBrandedEmail({
    headline: "Verify your email",
    bodyHtml,
    cta: email
      ? { label: "Open verification page", href: `${TRYVERSE_APP_URL}/auth/verify-email?email=${encodeURIComponent(email)}` }
      : undefined,
  });
}

export function signupVerificationEmailText(token: string, email?: string): string {
  return [
    "Welcome to TryVerse.",
    "",
    "You're one step away from activating your workspace.",
    "",
    "Your verification code is:",
    token,
    "",
    "Enter this code on the verify-email screen after sign-up to confirm your address and unlock your account.",
    ...(email ? ["", `Verification page: ${TRYVERSE_APP_URL}/auth/verify-email?email=${encodeURIComponent(email)}`] : []),
    "",
    `This verification code expires in ${SIGNUP_VERIFICATION_EXPIRY_MINUTES} minutes. If it expires before you enter it, just start signing up again with the same email and password — we'll send a fresh code. If you did not create an account, you can ignore this email.`,
    "",
    "— The TryVerse Team",
    "TryVerse AI",
    "AI Infrastructure for Fashion Visualization",
    TRYVERSE_APP_URL,
    TRYVERSE_CONTACT_EMAIL,
  ].join("\n");
}

export function passwordResetEmailHtml(token: string): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;">We received a request to reset your TryVerse password.</p>
    <p style="margin:0 0 16px;">Enter the code below on the reset password page along with your new password.</p>
    ${renderVerificationCodeBlock(token)}
    <p style="margin:0;font-size:14px;color:#888888;line-height:1.6;">This code expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes. If it expires, just request a new one from the reset password page — that&rsquo;s expected. If you did not request a reset, you can safely ignore this email; your password will not change.</p>`;
  return renderBrandedEmail({
    headline: "Reset your password",
    bodyHtml,
  });
}

export function passwordResetEmailText(token: string): string {
  return [
    "We received a request to reset your TryVerse password.",
    "",
    "Your password reset code is:",
    token,
    "",
    "Enter it on the TryVerse reset password page along with your new password.",
    "",
    `This code expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes. If it expires, just request a new one from the reset password page — that's expected. If you did not request a reset, ignore this email; your password will not change.`,
    "",
    "— The TryVerse Team",
    "TryVerse AI",
    TRYVERSE_APP_URL,
    TRYVERSE_CONTACT_EMAIL,
  ].join("\n");
}
