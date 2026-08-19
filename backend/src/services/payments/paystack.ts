import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errorHandler';
import { allocateCredits } from '../credits';
import {
  paymentSuccessExists,
  insertPaymentRow,
  upsertSubscriptionRow,
  cancelSubscriptionsForUserId,
} from '../billingConvexBridge';
import { cxGetPlan, cxGetProfile } from '../creditsConvexBridge';
import { cxInsertUsageEvent } from '../tryonConvexBridge';
import { sendPaymentConfirmationEmail, sendFailedPaymentEmail } from '../email';
import type { PaystackWebhookEvent } from '../../types';

const PAYSTACK_API = 'https://api.paystack.co';

/**
 * Initializes a Paystack payment transaction.
 * Returns the authorization URL for the checkout redirect.
 */
export async function initializePaystackPayment(params: {
  email: string;
  /** Whole naira (minor units applied inside); must match DB plan price server-side */
  amount: number;
  planId: string;
  userId: string;
  callbackUrl: string;
}): Promise<{ authorization_url: string; reference: string }> {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack is not configured');
  }
  const reference = `TV_PS_${params.userId.slice(0, 8)}_${Date.now()}`;

  let response;
  try {
    response = await axios.post(
      `${PAYSTACK_API}/transaction/initialize`,
      {
        email: params.email,
        amount: params.amount * 100, // convert to kobo
        reference,
        callback_url: params.callbackUrl,
        metadata: {
          user_id: params.userId,
          plan_id: params.planId,
          cancel_action: `${params.callbackUrl}?payment=cancelled`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (e) {
    // Same failure mode as Flutterwave: axios only surfaces the HTTP status in e.message,
    // losing Paystack's actual rejection reason from the response body.
    if (axios.isAxiosError(e)) {
      const body = e.response?.data as { message?: string } | undefined;
      logger.error('Paystack payment initialization request failed', {
        status: e.response?.status,
        body: e.response?.data,
        reference,
      });
      throw new AppError(`Payment initialization failed: ${body?.message || e.message}`, 502);
    }
    throw e;
  }

  if (!response.data.status) {
    throw new AppError(`Payment initialization failed: ${response.data.message}`, 502);
  }

  logger.info('Paystack payment initialized', { reference, planId: params.planId });
  return {
    authorization_url: response.data.data.authorization_url,
    reference,
  };
}

/**
 * Verifies a Paystack transaction by reference.
 */
export async function verifyPaystackTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  metadata: { user_id: string; plan_id: string };
}> {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack is not configured');
  }
  const response = await axios.get(
    `${PAYSTACK_API}/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
    }
  );

  const data = response.data.data;
  return {
    status: data.status,
    amount: data.amount / 100,
    currency: data.currency,
    metadata: data.metadata,
  };
}

/**
 * Validates Paystack webhook signature.
 */
export function validatePaystackSignature(payload: string, signature: string): boolean {
  if (!env.PAYSTACK_WEBHOOK_SECRET || !signature) return false;
  const hash = crypto
    .createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  // Timing-safe: both sides are fixed-length hex from the same HMAC algorithm, so a length
  // mismatch can only mean an invalid signature — safe to short-circuit before the byte compare.
  const a = Buffer.from(hash, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Processes a verified Paystack webhook event.
 */
export async function handlePaystackWebhook(event: PaystackWebhookEvent): Promise<void> {
  logger.info('Processing Paystack webhook', { event: event.event });

  if (event.event === 'charge.success') {
    const { reference, amount, currency, metadata, customer } = event.data;

    if (!metadata?.user_id || !metadata?.plan_id) {
      logger.error('Missing metadata in Paystack webhook', { reference });
      return;
    }

    if (await paymentSuccessExists(reference)) {
      logger.warn('Duplicate Paystack webhook — already processed', { reference });
      return;
    }

    try {
      await insertPaymentRow({
        user_id: metadata.user_id,
        reference,
        amount: amount / 100,
        currency,
        status: 'success',
        provider: 'paystack',
      });
    } catch (paymentError) {
      logger.error('Failed to record payment', { error: String(paymentError) });
    }

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    await upsertSubscriptionRow({
      user_id: metadata.user_id,
      plan_id: metadata.plan_id,
      status: 'active',
      provider: 'paystack',
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
    });

    // Allocate credits
    await allocateCredits(metadata.user_id, metadata.plan_id, 'paystack');

    // Send payment confirmation email
    try {
      const plan = await cxGetPlan(metadata.plan_id);
      const profile = await cxGetProfile(metadata.user_id);
      const name =
        String((profile as { full_name?: string } | null)?.full_name || '') ||
        String((profile as { brand_name?: string } | null)?.brand_name || '');
      await sendPaymentConfirmationEmail({
        email: customer.email,
        name,
        planName: String((plan as { name?: string } | null)?.name || metadata.plan_id),
        amount: String(amount / 100),
        currency,
        credits: Number((plan as { tryons_per_month?: number } | null)?.tryons_per_month ?? 0),
      });
    } catch (e) {
      logger.warn('Failed to send payment confirmation email', { error: String(e) });
    }

    await cxInsertUsageEvent(metadata.user_id, 'subscription_activated', {
      plan_id: metadata.plan_id,
      provider: 'paystack',
      reference,
      amount: amount / 100,
      currency,
      customer_email: customer.email,
    });

    logger.info('Paystack subscription activated', {
      userId: metadata.user_id,
      planId: metadata.plan_id,
    });
  }

  if (event.event === 'charge.failed') {
    const { metadata, customer } = event.data;
    if (customer?.email && metadata?.user_id) {
      try {
        const profile = await cxGetProfile(metadata.user_id);
        const name =
          String((profile as { full_name?: string } | null)?.full_name || '') ||
          String((profile as { brand_name?: string } | null)?.brand_name || '');
        await sendFailedPaymentEmail({
          email: customer.email,
          name,
          reason: 'Please check your payment method and try again.',
        });
      } catch (e) {
        logger.warn('Failed to send payment failure email', { error: String(e) });
      }
    }
  }

  if (event.event === 'subscription.disable') {
    const userId = event.data.metadata?.user_id;
    if (userId) {
      await cancelSubscriptionsForUserId(userId);
      logger.info('Paystack subscription cancelled', { userId });
    }
  }
}
