/**
 * Reusable branded HTML layout for TryVerse transactional emails.
 * Table-based, inline styles — compatible with Gmail, Outlook, and Apple Mail.
 */

export const TRYVERSE_LOGO_URL = 'https://tryverseai.com/tryverse-logo.png';
export const TRYVERSE_APP_URL = 'https://tryverseai.com';
export const TRYVERSE_CONTACT_EMAIL = 'info@tryverseai.com';

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface BrandedEmailCta {
  label: string;
  href: string;
}

export interface BrandedEmailOptions {
  /** Main headline below the logo */
  headline: string;
  /** HTML body content (paragraphs, lists, code blocks — already escaped where needed) */
  bodyHtml: string;
  /** Optional primary call-to-action button */
  cta?: BrandedEmailCta;
  /** Optional closing line before the signature (plain text, will be escaped) */
  closingLine?: string;
}

/**
 * Renders a complete branded transactional email.
 */
export function renderBrandedEmail(options: BrandedEmailOptions): string {
  const { headline, bodyHtml, cta, closingLine } = options;
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
    : '';

  const closingBlock = closingLine
    ? `<tr>
        <td style="padding:0 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;">
          <p style="margin:24px 0 0;">${escapeHtml(closingLine)}</p>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${safeHeadline}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e8ea;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding:36px 32px 24px;">
              <a href="${TRYVERSE_APP_URL}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                <img src="${TRYVERSE_LOGO_URL}" alt="TryVerse AI" width="140" height="auto"
                     style="display:block;border:0;outline:none;text-decoration:none;max-width:140px;height:auto;margin:0 auto;"
                     />
              </a>
            </td>
          </tr>
          <!-- Headline -->
          <tr>
            <td style="padding:0 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <h1 style="margin:0;font-size:22px;font-weight:700;line-height:1.35;color:#000000;letter-spacing:-0.02em;text-align:center;">
                ${safeHeadline}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:16px 32px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3d3d3d;">
              ${bodyHtml}
            </td>
          </tr>
          ${ctaBlock}
          ${closingBlock}
          <!-- Signature -->
          <tr>
            <td style="padding:16px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3d3d3d;">
              <p style="margin:0;">&mdash;<br/>The TryVerse Team</p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e8e8ea;margin:0;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#888888;">
              <p style="margin:0 0 4px;font-weight:600;color:#666666;">TryVerse AI</p>
              <p style="margin:0 0 12px;">AI-Powered Virtual Try-On Infrastructure</p>
              <p style="margin:0;">
                <a href="${TRYVERSE_APP_URL}" style="color:#666666;text-decoration:underline;">${TRYVERSE_APP_URL.replace(/^https?:\/\//, '')}</a>
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

/** Large verification code block for OTP emails */
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

/** Styled bullet list for feature highlights */
export function renderBulletList(items: string[]): string {
  const lis = items
    .map(
      (item) =>
        `<tr><td style="padding:4px 0 4px 0;vertical-align:top;width:20px;color:#888888;">&bull;</td><td style="padding:4px 0 4px 8px;color:#3d3d3d;">${escapeHtml(item)}</td></tr>`
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 8px;width:100%;">${lis}</table>`;
}
