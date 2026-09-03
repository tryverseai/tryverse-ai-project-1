import { env } from '../config/env';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../config/convexHttp';

const secret = () => ({ secret: env.BACKEND_SHARED_SECRET });

export async function paymentSuccessExists(reference: string): Promise<boolean> {
  return convexQueryTrusted<boolean>(anyApi.backendTrusted.paymentSuccessExists, {
    ...secret(),
    reference,
  });
}

export async function insertPaymentRow(args: {
  user_id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
}): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.insertPaymentTrusted, { ...secret(), ...args });
}

/**
 * Atomic check-and-insert — prefer this over the separate `paymentSuccessExists` + `insertPaymentRow`
 * pair, which has a TOCTOU window on duplicate webhook delivery (see `insertPaymentIfNewTrusted`'s
 * own doc comment). Returns `false` when a successful row for this reference already existed (no
 * second row written), `true` when this call actually inserted it.
 */
export async function insertPaymentIfNew(args: {
  user_id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
}): Promise<boolean> {
  const result = (await convexMutationTrusted(anyApi.backendTrusted.insertPaymentIfNewTrusted, {
    ...secret(),
    ...args,
  })) as { inserted: boolean };
  return result.inserted;
}

export interface PaymentIntentRow {
  reference: string;
  provider: string;
  user_id: string;
  plan_id: string;
  expected_amount: number;
  expected_currency: string;
  created_at: string;
}

/** Written at payment-initialize time — see convex/schema.ts's payment_intents doc comment. */
export async function insertPaymentIntent(args: {
  reference: string;
  provider: string;
  user_id: string;
  plan_id: string;
  expected_amount: number;
  expected_currency: string;
}): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.insertPaymentIntentTrusted, { ...secret(), ...args });
}

export async function getPaymentIntentByReference(reference: string): Promise<PaymentIntentRow | null> {
  const result = await convexQueryTrusted(anyApi.backendTrusted.getPaymentIntentByReferenceTrusted, {
    ...secret(),
    reference,
  });
  return (result as PaymentIntentRow | null) ?? null;
}

export async function upsertSubscriptionRow(args: {
  user_id: string;
  plan_id: string;
  status: string;
  provider: string;
  current_period_start: string;
  current_period_end: string;
  provider_subscription_id?: string;
}): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.upsertSubscriptionForUser, { ...secret(), ...args });
}

export async function cancelSubscriptionsForUserId(user_id: string): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.cancelSubscriptionsForUser, { ...secret(), user_id });
}
