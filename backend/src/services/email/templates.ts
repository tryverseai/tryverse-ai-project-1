/**
 * HTML email templates for TryVerse transactional emails.
 * Simple, responsive, and brand-aligned.
 */

const DEFAULT_APP_URL = 'https://tryverseai.com';

const STYLES = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  max-width: 560px;
  margin: 0 auto;
`;

const BUTTON_STYLES = `
  display: inline-block;
  padding: 12px 24px;
  background: #000;
  color: #fff !important;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  margin-top: 16px;
`;

export function welcomeEmail(params: { name: string; brandName: string; appUrl?: string }) {
  const { name, brandName, appUrl = DEFAULT_APP_URL } = params;
  const displayName = name || brandName || 'there';
  return {
    subject: 'Welcome to TryVerse — Your account is ready',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">Welcome to TryVerse</h1>
    <p>Hi ${escapeHtml(displayName)},</p>
    <p>Your TryVerse account is ready. Start with <strong>20 free AI try-ons</strong> to experience virtual try-on on your products.</p>
    <ul style="margin: 20px 0;">
      <li>Add products to your catalog</li>
      <li>Embed the widget on your store</li>
      <li>Let shoppers try products on before buying</li>
    </ul>
    <a href="${appUrl}/dashboard" style="${BUTTON_STYLES}">Open Dashboard</a>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team</p>
  </div>
</body>
</html>`,
  };
}

export function accountVerifiedEmail(params: { firstName?: string; signInUrl?: string }) {
  const displayFirst = escapeHtml(((params.firstName || 'there').trim() || 'there'));
  const signInUrlRaw = params.signInUrl ?? `${DEFAULT_APP_URL.replace(/\/$/, '')}/auth`;
  const signInHref = escapeHtml(signInUrlRaw);

  return {
    subject: 'Your TryVerse account has been verified',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <p>Hi ${displayFirst},</p>
    <p>Your TryVerse account has been successfully verified and is now active.</p>
    <p>You can now sign in and access your TryVerse experience — including virtual try-ons, AI-powered fashion visualization, and early access features currently available on the platform.</p>
    <p>We&apos;re excited to have you as part of the early TryVerse community.</p>
    <p>Sign in below to get started:</p>
    <a href="${signInHref}" style="${BUTTON_STYLES}">Sign In to TryVerse</a>
    <p style="margin-top: 24px;">If you did not create this account, you can safely ignore this email.</p>
    <p>Welcome to the future of fashion commerce.</p>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team<br/><a href="https://tryverseai.com" style="color:#666;">https://tryverseai.com</a></p>
  </div>
</body>
</html>`,
  };
}

export function apiKeyDeliveryEmail(params: { name: string; keyName: string; keyPreview: string; appUrl?: string }) {
  const { name, keyName, keyPreview, appUrl = DEFAULT_APP_URL } = params;
  return {
    subject: 'Your TryVerse API key is ready',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">API Key Created</h1>
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>Your API key <strong>${escapeHtml(keyName)}</strong> has been created successfully.</p>
    <p style="font-family: monospace; background: #f5f5f5; padding: 12px; border-radius: 6px;">${escapeHtml(keyPreview)}</p>
    <p style="font-size: 14px; color: #666;">You saw the full key only once when it was generated. Store it securely. If you didn't save it, revoke this key and create a new one in your dashboard.</p>
    <a href="${appUrl}/dashboard" style="${BUTTON_STYLES}">Manage API Keys</a>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team</p>
  </div>
</body>
</html>`,
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
  return {
    subject: 'Payment confirmed — Your TryVerse subscription is active',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">Payment Confirmed</h1>
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>Thank you for subscribing to TryVerse. Your payment of <strong>${escapeHtml(currency)} ${escapeHtml(String(amount))}</strong> for the <strong>${escapeHtml(planName)}</strong> plan has been confirmed.</p>
    <p><strong>Credits added:</strong> ${escapeHtml(String(credits))} ${credits === -1 ? 'unlimited' : 'try-ons per month'}</p>
    <a href="${appUrl}/dashboard" style="${BUTTON_STYLES}">Open Dashboard</a>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team</p>
  </div>
</body>
</html>`,
  };
}

export function creditsAddedEmail(params: { name: string; credits: number | string; reason?: string; appUrl?: string }) {
  const { name, credits, reason, appUrl = DEFAULT_APP_URL } = params;
  return {
    subject: 'Credits added to your TryVerse account',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">Credits Added</h1>
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>${escapeHtml(reason || 'We\'ve added')} <strong>${escapeHtml(String(credits))}</strong> try-on credit${Number(credits) !== 1 ? 's' : ''} to your account.</p>
    <a href="${appUrl}/dashboard" style="${BUTTON_STYLES}">View Dashboard</a>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team</p>
  </div>
</body>
</html>`,
  };
}

export function lowCreditsWarningEmail(params: { name: string; remaining: number; appUrl?: string }) {
  const { name, remaining, appUrl = DEFAULT_APP_URL } = params;
  return {
    subject: `TryVerse: Low credits — ${remaining} try-on${remaining !== 1 ? 's' : ''} remaining`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">Low Credits Warning</h1>
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>You have <strong>${remaining}</strong> try-on credit${remaining !== 1 ? 's' : ''} remaining.</p>
    <p>Upgrade your plan to keep the widget running for your shoppers.</p>
    <a href="${appUrl}/pricing" style="${BUTTON_STYLES}">Upgrade Plan</a>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team</p>
  </div>
</body>
</html>`,
  };
}

export function tryOnCompletedEmail(params: { name: string; resultUrl: string }) {
  const { name, resultUrl } = params;
  return {
    subject: 'Your TryVerse try-on result is ready',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">Your Try-On Result is Ready</h1>
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>Your AI try-on has been generated. Check it out:</p>
    <a href="${escapeHtml(resultUrl)}" style="${BUTTON_STYLES}">View Result</a>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team</p>
  </div>
</body>
</html>`,
  };
}

export function failedPaymentEmail(params: { name: string; reason?: string; appUrl?: string }) {
  const { name, reason, appUrl = DEFAULT_APP_URL } = params;
  return {
    subject: 'TryVerse: Payment failed — action required',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">Payment Failed</h1>
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>We couldn't process your recent payment.${reason ? ` ${escapeHtml(reason)}` : ''}</p>
    <p>Please update your payment method or try again.</p>
    <a href="${appUrl}/dashboard" style="${BUTTON_STYLES}">Update Payment</a>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team</p>
  </div>
</body>
</html>`,
  };
}

export function weeklySummaryEmail(params: { name: string; count: number; appUrl?: string }) {
  const { name, count, appUrl = DEFAULT_APP_URL } = params;
  return {
    subject: `You generated ${count} try-on${count !== 1 ? 's' : ''} this week`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${STYLES}">
  <div style="padding: 32px 24px;">
    <h1 style="font-size: 24px; margin-bottom: 16px;">Your Week on TryVerse</h1>
    <p>Hi ${escapeHtml(name || 'there')},</p>
    <p>You've generated <strong>${count}</strong> try-on result${count !== 1 ? 's' : ''} this week.</p>
    <a href="${appUrl}/dashboard" style="${BUTTON_STYLES}">View Analytics</a>
    <p style="margin-top: 32px; font-size: 14px; color: #666;">— The TryVerse Team</p>
  </div>
</body>
</html>`,
  };
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
