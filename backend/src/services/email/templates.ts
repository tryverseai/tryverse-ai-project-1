/**
 * HTML email templates for TryVerse transactional emails.
 * All templates use the shared branded layout in ./layout.ts
 */

import {
  renderBrandedEmail,
  renderVerificationCodeBlock,
  renderBulletList,
  escapeHtml,
} from './layout';

const DEFAULT_APP_URL = 'https://tryverseai.com';

function firstNameFrom(name: string, brandName?: string): string {
  const source = (name || brandName || '').trim();
  if (!source) return 'there';
  return source.split(/\s+/)[0] || 'there';
}

export function welcomeEmail(params: { name: string; brandName: string; appUrl?: string }) {
  const { name, brandName, appUrl = DEFAULT_APP_URL } = params;
  const first = firstNameFrom(name, brandName);
  const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(first)},</p>
    <p style="margin:0 0 16px;">Welcome to TryVerse.</p>
    <p style="margin:0 0 16px;">Your account has been successfully verified and your workspace is now active.</p>
    <p style="margin:0 0 16px;">You can now access the platform and begin exploring AI-powered virtual try-on experiences designed for modern fashion brands and e-commerce retailers.</p>
    <p style="margin:0 0 8px;font-weight:600;color:#1a1a1a;">What&rsquo;s available now</p>
    ${renderBulletList([
      'Your TryVerse dashboard is ready',
      '20 complimentary AI try-ons have been added to your account',
      'Upload products and generate virtual try-on experiences',
      'Explore integration options for your storefront',
    ])}
    <p style="margin:16px 0 0;font-weight:600;color:#1a1a1a;">Access your workspace</p>`;

  return {
    subject: 'Your TryVerse account is ready',
    html: renderBrandedEmail({
      headline: 'Your account is ready',
      bodyHtml,
      cta: { label: 'Open Dashboard', href: dashboardUrl },
      closingLine:
        "As we continue expanding the platform, you'll receive updates on new features, integrations, and capabilities designed to help brands improve customer confidence and reduce purchase uncertainty. We're excited to have you with us.",
    }),
  };
}

export function accountVerifiedEmail(params: { firstName?: string; signInUrl?: string }) {
  const first = escapeHtml(((params.firstName || 'there').trim() || 'there'));
  const signInUrlRaw = params.signInUrl ?? `${DEFAULT_APP_URL.replace(/\/$/, '')}/dashboard`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${first},</p>
    <p style="margin:0 0 16px;">Welcome to TryVerse.</p>
    <p style="margin:0 0 16px;">Your account has been successfully verified and your workspace is now active.</p>
    <p style="margin:0 0 16px;">You can now access the platform and begin exploring AI-powered virtual try-on experiences designed for modern fashion brands and e-commerce retailers.</p>
    <p style="margin:0 0 8px;font-weight:600;color:#1a1a1a;">What&rsquo;s available now</p>
    ${renderBulletList([
      'Your TryVerse dashboard is ready',
      '20 complimentary AI try-ons have been added to your account',
      'Upload products and generate virtual try-on experiences',
      'Explore integration options for your storefront',
    ])}
    <p style="margin:16px 0 0;font-weight:600;color:#1a1a1a;">Access your workspace</p>`;

  return {
    subject: 'Your TryVerse account is ready',
    html: renderBrandedEmail({
      headline: 'Your account is ready',
      bodyHtml,
      cta: { label: 'Open Dashboard', href: signInUrlRaw },
      closingLine:
        "As we continue expanding the platform, you'll receive updates on new features, integrations, and capabilities designed to help brands improve customer confidence and reduce purchase uncertainty. We're excited to have you with us.",
    }),
  };
}

export function deviceApprovalEmail(params: { firstName?: string; code: string; appUrl?: string }) {
  const displayFirst = escapeHtml(((params.firstName || 'there').trim() || 'there'));
  const { code, appUrl = DEFAULT_APP_URL } = params;
  const approveUrl = `${appUrl.replace(/\/$/, '')}/auth/approve-device`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${displayFirst},</p>
    <p style="margin:0 0 16px;">We noticed a sign-in attempt on a new browser or device. Enter the code below to approve it and continue to your workspace.</p>
    ${renderVerificationCodeBlock(code)}
    <p style="margin:0;font-size:14px;color:#888888;">This code expires in 10 minutes. If this wasn&rsquo;t you, you can ignore this email &mdash; your other sessions stay active.</p>`;

  return {
    subject: 'Approve this device for TryVerse',
    html: renderBrandedEmail({
      headline: 'Approve this browser',
      bodyHtml,
      cta: { label: 'Enter code in TryVerse', href: approveUrl },
    }),
  };
}

export function apiKeyDeliveryEmail(params: { name: string; keyName: string; keyPreview: string; appUrl?: string }) {
  const { name, keyName, keyPreview, appUrl = DEFAULT_APP_URL } = params;
  const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name || 'there')},</p>
    <p style="margin:0 0 16px;">Your API key <strong>${escapeHtml(keyName)}</strong> has been created successfully.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="background-color:#f8f8f9;border:1px solid #e8e8ea;border-radius:8px;padding:14px 16px;font-family:'SF Mono',SFMono-Regular,Consolas,monospace;font-size:13px;color:#1a1a1a;word-break:break-all;">
          ${escapeHtml(keyPreview)}
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:#888888;">You saw the full key only once when it was generated. Store it securely. If you didn&rsquo;t save it, revoke this key and create a new one in your dashboard.</p>`;

  return {
    subject: 'Your TryVerse API key is ready',
    html: renderBrandedEmail({
      headline: 'API key created',
      bodyHtml,
      cta: { label: 'Manage API Keys', href: dashboardUrl },
    }),
  };
}

export function paymentConfirmationEmail(params: {
  name: string;
  planName: string;
  amount: string;
  currency: string;
  credits: number | string;
  appUrl?: string;
}) {
  const { name, planName, amount, currency, credits, appUrl = DEFAULT_APP_URL } = params;
  const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard`;
  const creditsLabel =
    credits === -1 ? 'unlimited try-ons per month' : `${escapeHtml(String(credits))} try-ons per month`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name || 'there')},</p>
    <p style="margin:0 0 16px;">Thank you for subscribing to TryVerse. Your payment of <strong>${escapeHtml(currency)} ${escapeHtml(String(amount))}</strong> for the <strong>${escapeHtml(planName)}</strong> plan has been confirmed.</p>
    <p style="margin:0;"><strong>Credits added:</strong> ${creditsLabel}</p>`;

  return {
    subject: 'Payment confirmed — Your TryVerse subscription is active',
    html: renderBrandedEmail({
      headline: 'Payment confirmed',
      bodyHtml,
      cta: { label: 'Open Dashboard', href: dashboardUrl },
    }),
  };
}

export function creditsAddedEmail(params: { name: string; credits: number | string; reason?: string; appUrl?: string }) {
  const { name, credits, reason, appUrl = DEFAULT_APP_URL } = params;
  const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name || 'there')},</p>
    <p style="margin:0;">${escapeHtml(reason || "We've added")} <strong>${escapeHtml(String(credits))}</strong> try-on credit${Number(credits) !== 1 ? 's' : ''} to your account.</p>`;

  return {
    subject: 'Credits added to your TryVerse account',
    html: renderBrandedEmail({
      headline: 'Credits added',
      bodyHtml,
      cta: { label: 'View Dashboard', href: dashboardUrl },
    }),
  };
}

export function lowCreditsWarningEmail(params: { name: string; remaining: number; appUrl?: string }) {
  const { name, remaining, appUrl = DEFAULT_APP_URL } = params;
  const pricingUrl = `${appUrl.replace(/\/$/, '')}/pricing`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name || 'there')},</p>
    <p style="margin:0 0 16px;">You have <strong>${remaining}</strong> try-on credit${remaining !== 1 ? 's' : ''} remaining.</p>
    <p style="margin:0;">Upgrade your plan to keep the widget running for your shoppers.</p>`;

  return {
    subject: `TryVerse: Low credits — ${remaining} try-on${remaining !== 1 ? 's' : ''} remaining`,
    html: renderBrandedEmail({
      headline: 'Low credits warning',
      bodyHtml,
      cta: { label: 'Upgrade Plan', href: pricingUrl },
    }),
  };
}

export function tryOnCompletedEmail(params: { name: string; resultUrl: string }) {
  const { name, resultUrl } = params;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name || 'there')},</p>
    <p style="margin:0;">Your AI try-on has been generated and is ready to view.</p>`;

  return {
    subject: 'Your TryVerse try-on result is ready',
    html: renderBrandedEmail({
      headline: 'Your try-on is ready',
      bodyHtml,
      cta: { label: 'View Result', href: resultUrl },
    }),
  };
}

export function failedPaymentEmail(params: { name: string; reason?: string; appUrl?: string }) {
  const { name, reason, appUrl = DEFAULT_APP_URL } = params;
  const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name || 'there')},</p>
    <p style="margin:0 0 16px;">We couldn&rsquo;t process your recent payment.${reason ? ` ${escapeHtml(reason)}` : ''}</p>
    <p style="margin:0;">Please update your payment method or try again.</p>`;

  return {
    subject: 'TryVerse: Payment failed — action required',
    html: renderBrandedEmail({
      headline: 'Payment failed',
      bodyHtml,
      cta: { label: 'Update Payment', href: dashboardUrl },
    }),
  };
}

export function weeklySummaryEmail(params: { name: string; count: number; appUrl?: string }) {
  const { name, count, appUrl = DEFAULT_APP_URL } = params;
  const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${escapeHtml(name || 'there')},</p>
    <p style="margin:0;">You&rsquo;ve generated <strong>${count}</strong> try-on result${count !== 1 ? 's' : ''} this week.</p>`;

  return {
    subject: `You generated ${count} try-on${count !== 1 ? 's' : ''} this week`,
    html: renderBrandedEmail({
      headline: 'Your week on TryVerse',
      bodyHtml,
      cta: { label: 'View Analytics', href: dashboardUrl },
    }),
  };
}
