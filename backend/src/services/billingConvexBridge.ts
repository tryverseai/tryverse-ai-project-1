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
