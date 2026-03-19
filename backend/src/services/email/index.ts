import { supabaseAdmin } from '../../config/supabase';
import { env } from '../../config/env';
import { sendEmail } from './resend';
import {
  welcomeEmail,
  apiKeyDeliveryEmail,
  paymentConfirmationEmail,
  creditsAddedEmail,
  lowCreditsWarningEmail,
  tryOnCompletedEmail,
  failedPaymentEmail,
  weeklySummaryEmail,
} from './templates';

const appUrl = env.FRONTEND_URL || 'https://app.tryverse.ai';

async function getUserEmailAndName(userId: string): Promise<{ email: string | null; name: string }> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('contact_email, full_name, brand_name')
    .eq('id', userId)
    .single();

  let email: string | null = profile?.contact_email || null;
  if (!email) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = authUser?.user?.email || null;
  }

  const name = profile?.full_name || profile?.brand_name || '';
  return { email, name };
}

export async function sendWelcomeEmail(params: {
  email: string;
  name?: string;
  brandName?: string;
}): Promise<boolean> {
  const t = welcomeEmail({
    name: params.name || '',
    brandName: params.brandName || '',
    appUrl,
  });
  return sendEmail({ to: params.email, subject: t.subject, html: t.html });
}

export async function sendApiKeyDeliveryEmail(params: {
  email: string;
  name?: string;
  keyName: string;
  keyPreview: string;
}): Promise<boolean> {
  const t = apiKeyDeliveryEmail({
    name: params.name || '',
    keyName: params.keyName,
    keyPreview: params.keyPreview,
    appUrl,
  });
  return sendEmail({ to: params.email, subject: t.subject, html: t.html });
}

export async function sendPaymentConfirmationEmail(params: {
  email: string;
  name?: string;
  planName: string;
  amount: string;
  currency: string;
  credits: number | string;
}): Promise<boolean> {
  const t = paymentConfirmationEmail({
    name: params.name || '',
    planName: params.planName,
    amount: params.amount,
    currency: params.currency,
    credits: params.credits,
    appUrl,
  });
  return sendEmail({ to: params.email, subject: t.subject, html: t.html });
}

export async function sendCreditsAddedEmail(params: {
  email: string;
  name?: string;
  credits: number | string;
  reason?: string;
}): Promise<boolean> {
  const t = creditsAddedEmail({
    name: params.name || '',
    credits: params.credits,
    reason: params.reason,
    appUrl,
  });
  return sendEmail({ to: params.email, subject: t.subject, html: t.html });
}

export async function sendLowCreditsWarningEmail(userId: string, remaining: number): Promise<boolean> {
  const { email, name } = await getUserEmailAndName(userId);
  if (!email) return false;

  const t = lowCreditsWarningEmail({ name, remaining, appUrl });
  return sendEmail({ to: email, subject: t.subject, html: t.html });
}

export async function sendTryOnCompletedEmail(userId: string, resultUrl: string): Promise<boolean> {
  if (!userId) return false;
  const { email, name } = await getUserEmailAndName(userId);
  if (!email) return false;

  const t = tryOnCompletedEmail({ name, resultUrl });
  return sendEmail({ to: email, subject: t.subject, html: t.html });
}

export async function sendFailedPaymentEmail(params: {
  email: string;
  name?: string;
  reason?: string;
}): Promise<boolean> {
  const t = failedPaymentEmail({
    name: params.name || '',
    reason: params.reason,
    appUrl,
  });
  return sendEmail({ to: params.email, subject: t.subject, html: t.html });
}

export async function sendWeeklySummaryEmail(userId: string, count: number): Promise<boolean> {
  const { email, name } = await getUserEmailAndName(userId);
  if (!email) return false;

  const t = weeklySummaryEmail({ name, count, appUrl });
  return sendEmail({ to: email, subject: t.subject, html: t.html });
}
