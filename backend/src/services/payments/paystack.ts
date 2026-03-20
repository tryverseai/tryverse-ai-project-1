import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { supabaseAdmin } from '../../config/supabase';
import { allocateCredits } from '../credits';
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

  const response = await axios.post(
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

  if (!response.data.status) {
    throw new Error(`Paystack initialization failed: ${response.data.message}`);
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
  if (!env.PAYSTACK_WEBHOOK_SECRET) return false;
  const hash = crypto
    .createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return hash === signature;
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

    // Deduplication: avoid processing the same payment twice
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('reference', reference)
      .eq('status', 'success')
      .single();

    if (existing) {
      logger.warn('Duplicate Paystack webhook — already processed', { reference });
      return;
    }

    // Record payment
    const { error: paymentError } = await supabaseAdmin.from('payments').insert({
      user_id: metadata.user_id,
      reference,
      amount: amount / 100,
      currency,
      status: 'success',
      provider: 'paystack',
    });

    if (paymentError) {
      logger.error('Failed to record payment', { error: paymentError.message });
    }

    // Upsert subscription
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: metadata.user_id,
        plan_id: metadata.plan_id,
        status: 'active',
        provider: 'paystack',
        current_period_start: now.toISOString(),
        current_period_end: nextMonth.toISOString(),
      },
      { onConflict: 'user_id' }
    );

    // Allocate credits
    await allocateCredits(metadata.user_id, metadata.plan_id, 'paystack');

    // Send payment confirmation email
    try {
      const { data: plan } = await supabaseAdmin.from('plans').select('name, tryons_per_month').eq('id', metadata.plan_id).single();
      const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, brand_name').eq('id', metadata.user_id).single();
      const name = profile?.full_name || profile?.brand_name || '';
      await sendPaymentConfirmationEmail({
        email: customer.email,
        name,
        planName: plan?.name || metadata.plan_id,
        amount: String(amount / 100),
        currency,
        credits: plan?.tryons_per_month ?? 0,
      });
    } catch (e) {
      logger.warn('Failed to send payment confirmation email', { error: String(e) });
    }

    // Log usage event
    await supabaseAdmin.from('usage_events').insert({
      user_id: metadata.user_id,
      event_type: 'subscription_activated',
      metadata: {
        plan_id: metadata.plan_id,
        provider: 'paystack',
        reference,
        amount: amount / 100,
        currency,
        customer_email: customer.email,
      },
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
        const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, brand_name').eq('id', metadata.user_id).single();
        const name = profile?.full_name || profile?.brand_name || '';
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
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('user_id', userId);

      logger.info('Paystack subscription cancelled', { userId });
    }
  }
}
