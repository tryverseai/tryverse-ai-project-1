import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  paymentSuccessExists,
  insertPaymentRow,
  upsertSubscriptionRow,
} from '../billingConvexBridge';
import { cxGetPlan, cxGetProfile } from '../creditsConvexBridge';
import { cxInsertUsageEvent } from '../tryonConvexBridge';
import { allocateCredits } from '../credits';
import { sendPaymentConfirmationEmail, sendFailedPaymentEmail } from '../email';
import type { FlutterwaveWebhookEvent } from '../../types';

const FLW_API = 'https://api.flutterwave.com/v3';

/**
 * Initializes a Flutterwave payment.
 * Supports multi-currency (USD, NGN, GHS, KES, ZAR, etc.)
 */
export async function initializeFlutterwavePayment(params: {
  email: string;
  amount: number;
  currency: string;
  planId: string;
  userId: string;
  callbackUrl: string;
  fullName?: string;
}): Promise<{ authorization_url: string; tx_ref: string }> {
  if (!env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error('Flutterwave is not configured');
  }
  const tx_ref = `TV_FLW_${params.userId.slice(0, 8)}_${Date.now()}`;

  const response = await axios.post(
    `${FLW_API}/payments`,
    {
      tx_ref,
      amount: params.amount,
      currency: params.currency,
      redirect_url: params.callbackUrl,
      customer: {
        email: params.email,
        name: params.fullName || 'TryVerse User',
      },
      meta: {
        user_id: params.userId,
        plan_id: params.planId,
      },
      customizations: {
        title: 'TryVerse',
        description: `Subscribe to ${params.planId} plan`,
        logo: 'https://tryverseai.com/logo.png',
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.status !== 'success') {
    throw new Error(`Flutterwave initialization failed: ${response.data.message}`);
  }

  logger.info('Flutterwave payment initialized', { tx_ref, planId: params.planId });
  return {
    authorization_url: response.data.data.link,
    tx_ref,
  };
}

/**
 * Verifies a Flutterwave transaction by ID.
 */
export async function verifyFlutterwaveTransaction(transactionId: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  meta: { user_id: string; plan_id: string };
}> {
  if (!env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error('Flutterwave is not configured');
  }
  const response = await axios.get(`${FLW_API}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}` },
  });

  const data = response.data.data;
  return {
    status: data.status,
    amount: data.amount,
    currency: data.currency,
    meta: data.meta,
  };
}

/**
 * Validates Flutterwave webhook.
 * Flutterwave sends your configured secret hash in the verif-hash header.
 * Compare: incoming verif-hash must equal FLUTTERWAVE_WEBHOOK_SECRET.
 */
export function validateFlutterwaveSignature(_payload: string, verifHash: string): boolean {
  if (!env.FLUTTERWAVE_WEBHOOK_SECRET || !verifHash) return false;
  // Timing-safe: this is a direct secret comparison (not HMAC), so length alone already leaks
  // less than a naive === would under a timing attack — still worth closing with timingSafeEqual.
  const a = Buffer.from(env.FLUTTERWAVE_WEBHOOK_SECRET, 'utf8');
  const b = Buffer.from(verifHash, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Processes a verified Flutterwave webhook event.
 */
export async function handleFlutterwaveWebhook(event: FlutterwaveWebhookEvent): Promise<void> {
  logger.info('Processing Flutterwave webhook', { event: event.event });

  if (event.event === 'charge.completed' && event.data.status === 'successful') {
    const { tx_ref, amount, currency, meta, customer } = event.data;

    if (!meta?.user_id || !meta?.plan_id) {
      logger.error('Missing meta in Flutterwave webhook', { tx_ref });
      return;
    }

    if (await paymentSuccessExists(tx_ref)) {
      logger.warn('Duplicate Flutterwave webhook — already processed', { tx_ref });
      return;
    }

    await insertPaymentRow({
      user_id: meta.user_id,
      reference: tx_ref,
      amount,
      currency,
      status: 'success',
      provider: 'flutterwave',
    });

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    await upsertSubscriptionRow({
      user_id: meta.user_id,
      plan_id: meta.plan_id,
      status: 'active',
      provider: 'flutterwave',
      provider_subscription_id: String(event.data.id),
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
    });

    // Allocate credits
    await allocateCredits(meta.user_id, meta.plan_id, 'flutterwave');

    // Send payment confirmation email
    try {
      const plan = await cxGetPlan(meta.plan_id);
      const profile = await cxGetProfile(meta.user_id);
      const name =
        String((profile as { full_name?: string } | null)?.full_name || '') ||
        String((profile as { brand_name?: string } | null)?.brand_name || '');
      await sendPaymentConfirmationEmail({
        email: customer.email,
        name,
        planName: String((plan as { name?: string } | null)?.name || meta.plan_id),
        amount: String(amount),
        currency,
        credits: Number((plan as { tryons_per_month?: number } | null)?.tryons_per_month ?? 0),
      });
    } catch (e) {
      logger.warn('Failed to send payment confirmation email', { error: String(e) });
    }

    await cxInsertUsageEvent(meta.user_id, 'subscription_activated', {
      plan_id: meta.plan_id,
      provider: 'flutterwave',
      tx_ref,
      amount,
      currency,
      customer_email: customer.email,
    });

    logger.info('Flutterwave subscription activated', {
      userId: meta.user_id,
      planId: meta.plan_id,
    });
  }

  if (event.event === 'charge.failed' || (event.event === 'charge.completed' && event.data.status !== 'successful')) {
    const { meta, customer } = event.data;
    const email = customer?.email;
    const userId = meta?.user_id;
    if (email && userId) {
      try {
        const profile = await cxGetProfile(userId);
        const name =
          String((profile as { full_name?: string } | null)?.full_name || '') ||
          String((profile as { brand_name?: string } | null)?.brand_name || '');
        await sendFailedPaymentEmail({
          email,
          name,
          reason: 'Please check your payment method and try again.',
        });
      } catch (e) {
        logger.warn('Failed to send payment failure email', { error: String(e) });
      }
    }
  }
}
