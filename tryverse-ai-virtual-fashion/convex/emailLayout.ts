/**
 * Branded HTML layout for Convex Auth transactional emails (Resend).
 * Mirrors backend/src/services/email/layout.ts — presentation only.
 */

export const TRYVERSE_LOGO_URL = "https://tryverseai.com/tryverse-logo.png";
export const TRYVERSE_APP_URL = "https://tryverseai.com";
export const TRYVERSE_CONTACT_EMAIL = "info@tryverseai.com";

/** Branded sender — display name "TryVerse AI" */
export const TRYVERSE_AUTH_EMAIL_FROM = "TryVerse AI <info@tryverseai.com>";

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
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td align="center" style="background-color:#f8f8f9;border:1px solid #e8e8ea;border-radius:10px;padding:28px 20px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#888888;">Verification code</p>
        <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.28em;color:#000000;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;">${safe}</p>
      </td>
    </tr>
  </table>`;
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
             style="display:inline-block;padding:14px 32px;background-color:#000000;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.01em;">
            <span style="color:#ffffff;">${escapeHtml(cta.label)}</span>
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
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeHeadline}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e8ea;">
          <tr>
            <td align="center" style="padding:36px 32px 24px;">
              <a href="${TRYVERSE_APP_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                <img src="${TRYVERSE_LOGO_URL}" alt="TryVerse AI" width="140" height="auto"
                     style="display:block;border:0;outline:none;max-width:140px;height:auto;margin:0 auto;" />
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
              <p style="margin:0 0 12px;">AI-Powered Virtual Try-On Infrastructure</p>
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

export function signupVerificationEmailHtml(token: string): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;">Welcome to TryVerse.</p>
    <p style="margin:0 0 16px;">Enter the verification code below on the verify-email screen to confirm your address and activate your account.</p>
    ${renderVerificationCodeBlock(token)}
    <p style="margin:0;font-size:14px;color:#888888;">This code expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>`;
  return renderBrandedEmail({
    headline: "Verify your email",
    bodyHtml,
  });
}

export function signupVerificationEmailText(token: string): string {
  return [
    "Welcome to TryVerse.",
    "",
    "Your verification code is:",
    token,
    "",
    "Enter this code on the verify-email screen after sign-up to confirm your address and activate your account.",
    "",
    "This code expires in 24 hours. If you did not create an account, you can ignore this email.",
    "",
    "— The TryVerse Team",
    "TryVerse AI",
    "AI-Powered Virtual Try-On Infrastructure",
    TRYVERSE_APP_URL,
    TRYVERSE_CONTACT_EMAIL,
  ].join("\n");
}

export function passwordResetEmailHtml(token: string): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;">We received a request to reset your TryVerse password.</p>
    <p style="margin:0 0 16px;">Enter the code below on the reset password page along with your new password.</p>
    ${renderVerificationCodeBlock(token)}
    <p style="margin:0;font-size:14px;color:#888888;">This code expires in 24 hours. If you did not request a reset, you can safely ignore this email.</p>`;
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
    "This code expires in 24 hours. If you did not request a reset, ignore this email.",
    "",
    "— The TryVerse Team",
    "TryVerse AI",
    TRYVERSE_APP_URL,
    TRYVERSE_CONTACT_EMAIL,
  ].join("\n");
}
