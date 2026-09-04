import { TRYVERSE_TRANSACTIONAL_FROM } from './fromAddress';

/** Fixed outbound sender per product requirement for lifecycle invite mail. */
export const FIXED_FROM = TRYVERSE_TRANSACTIONAL_FROM;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeUrl(u: string): string {
  return u.replace(/\s/g, '').trim();
}

export function businessInviteBodies(params: {
  name: string;
  email: string;
  companyName: string;
  inviteUrl: string;
}): { subject: string; html: string; text: string } {
  const name = params.name.trim() || 'there';
  const co = params.companyName.trim() || 'Your organization';
  const em = sanitizeEmailRecipientCopy(params.email);
  const safeUrl = sanitizeUrl(params.inviteUrl);
  const href = escapeHtml(safeUrl);
  const html = `
<p>Hi ${escapeHtml(name)},</p>
<p>Your application for TryVerse business access has been approved.</p>
<p>${escapeHtml(co)} has been selected for founding member access — AI-powered virtual try-on built for brands and retail teams serious about the future of fashion commerce.</p>
<p>Your exclusive access link is below. This link is unique to your account and expires after use.</p>
<p><a href="${href}">Activate Business Access →</a></p>
<p>This invitation was issued exclusively for ${escapeHtml(em)}.<br/>
If you did not request access, please contact info@tryverseai.com</p>
<p>— The TryVerse Team<br/>
<a href="https://tryverseai.com">tryverseai.com</a> · info@tryverseai.com</p>
`.trim();
  const text = [
    `Hi ${name},`,
    '',
    'Your application for TryVerse business access has been approved.',
    '',
    `${co} has been selected for founding member access — AI-powered virtual try-on built for brands and retail teams serious about the future of fashion commerce.`,
    '',
    'Your exclusive access link is below. This link is unique to your account and expires after use.',
    '',
    safeUrl,
    '',
    `This invitation was issued exclusively for ${em}.`,
    'If you did not request access, please contact info@tryverseai.com',
    '',
    '— The TryVerse Team',
    'tryverseai.com · info@tryverseai.com',
  ].join('\n');
  return {
    subject: 'Your TryVerse Business Access is Ready',
    html,
    text,
  };
}

function sanitizeEmailRecipientCopy(email: string): string {
  return email.trim().toLowerCase();
}
