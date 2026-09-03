/**
 * Pure comparison between what a payment was initialized for (a `payment_intents` row, written
 * server-side at `/api/payment/initialize/*` time, before the provider is ever involved) and what
 * a webhook later reports was actually charged. No I/O — deliberately separate from the Convex/
 * network-calling webhook handlers so this can be unit-tested without mocking either.
 *
 * Both `expected_amount`/`amount` must already be normalized to the SAME major-unit currency
 * representation (e.g. naira, not kobo) by the caller — Paystack's webhook reports kobo and must
 * be divided by 100 before calling this; Flutterwave already reports major units.
 */
export interface PaymentIntentRecord {
  user_id: string;
  plan_id: string;
  expected_amount: number;
  expected_currency: string;
}

export interface ReceivedPayment {
  user_id: string;
  plan_id: string;
  amount: number;
  currency: string;
}

export type PaymentMismatchReason = 'user_mismatch' | 'plan_mismatch' | 'currency_mismatch' | 'amount_mismatch';

export type PaymentValidationResult = { ok: true } | { ok: false; reason: PaymentMismatchReason };

// Tolerates float rounding noise in major-unit currency arithmetic (e.g. 1999.9999999999998),
// not a meaningful amount of money — anything larger is a real mismatch.
const AMOUNT_EPSILON = 0.01;

export function validatePaymentAgainstIntent(
  intent: PaymentIntentRecord,
  received: ReceivedPayment
): PaymentValidationResult {
  if (intent.user_id !== received.user_id) return { ok: false, reason: 'user_mismatch' };
  if (intent.plan_id !== received.plan_id) return { ok: false, reason: 'plan_mismatch' };
  if (intent.expected_currency.trim().toUpperCase() !== received.currency.trim().toUpperCase()) {
    return { ok: false, reason: 'currency_mismatch' };
  }
  if (Math.abs(intent.expected_amount - received.amount) > AMOUNT_EPSILON) {
    return { ok: false, reason: 'amount_mismatch' };
  }
  return { ok: true };
}
