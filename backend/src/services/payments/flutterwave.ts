import axios from 'axios';
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { supabaseAdmin } from '../../config/supabase';
import { allocateCredits } from '../credits';
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
        logo: 'https://tryverse.ai/logo.png',
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
  return verifHash === env.FLUTTERWAVE_WEBHOOK_SECRET && verifHash.length > 0;
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

    // Check for duplicate processing
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('reference', tx_ref)
      .eq('status', 'success')
      .single();

    if (existing) {
      logger.warn('Duplicate Flutterwave webhook — already processed', { tx_ref });
      return;
    }

    // Record payment
    await supabaseAdmin.from('payments').insert({
      user_id: meta.user_id,
      reference: tx_ref,
      amount,
      currency,
      status: 'success',
      provider: 'flutterwave',
    });

    // Upsert subscription
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: meta.user_id,
        plan_id: meta.plan_id,
        status: 'active',
        provider: 'flutterwave',
        provider_subscription_id: String(event.data.id),
        current_period_start: now.toISOString(),
        current_period_end: nextMonth.toISOString(),
      },
      { onConflict: 'user_id' }
    );

    // Allocate credits
    await allocateCredits(meta.user_id, meta.plan_id, 'flutterwave');

    // Log usage event
    await supabaseAdmin.from('usage_events').insert({
      user_id: meta.user_id,
      event_type: 'subscription_activated',
      metadata: {
        plan_id: meta.plan_id,
        provider: 'flutterwave',
        tx_ref,
        amount,
        currency,
        customer_email: customer.email,
      },
    });

    logger.info('Flutterwave subscription activated', {
      userId: meta.user_id,
      planId: meta.plan_id,
    });
  }
}
