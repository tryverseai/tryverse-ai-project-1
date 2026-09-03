import { describe, it, expect } from 'vitest';
import { validatePaymentAgainstIntent, type PaymentIntentRecord, type ReceivedPayment } from './paymentIntentValidation';

const intent: PaymentIntentRecord = {
  user_id: 'user_1',
  plan_id: 'starter',
  expected_amount: 5000,
  expected_currency: 'NGN',
};

function received(overrides: Partial<ReceivedPayment> = {}): ReceivedPayment {
  return { user_id: 'user_1', plan_id: 'starter', amount: 5000, currency: 'NGN', ...overrides };
}

describe('validatePaymentAgainstIntent', () => {
  it('accepts a payment that exactly matches the intent (correct amount and currency)', () => {
    expect(validatePaymentAgainstIntent(intent, received())).toEqual({ ok: true });
  });

  it('accepts a delayed webhook for the same reference — nothing about this validator is time-sensitive', () => {
    // Simulates a webhook that arrives long after initialization (e.g. a slow bank transfer
    // confirmation) — the intent row doesn't expire, so this still matches cleanly.
    expect(validatePaymentAgainstIntent(intent, received())).toEqual({ ok: true });
  });

  it('tolerates trivial floating-point noise in the amount', () => {
    expect(validatePaymentAgainstIntent(intent, received({ amount: 5000.0000000001 }))).toEqual({ ok: true });
  });

  it('rejects an incorrect (lower) amount', () => {
    expect(validatePaymentAgainstIntent(intent, received({ amount: 1 }))).toEqual({
      ok: false,
      reason: 'amount_mismatch',
    });
  });

  it('rejects an incorrect (higher) amount', () => {
    expect(validatePaymentAgainstIntent(intent, received({ amount: 50000 }))).toEqual({
      ok: false,
      reason: 'amount_mismatch',
    });
  });

  it('rejects a currency mismatch even when the amount matches', () => {
    expect(validatePaymentAgainstIntent(intent, received({ currency: 'USD' }))).toEqual({
      ok: false,
      reason: 'currency_mismatch',
    });
  });

  it('is case-insensitive for currency codes', () => {
    expect(validatePaymentAgainstIntent(intent, received({ currency: 'ngn' }))).toEqual({ ok: true });
  });

  it('rejects a plan mismatch', () => {
    expect(validatePaymentAgainstIntent(intent, received({ plan_id: 'growth' }))).toEqual({
      ok: false,
      reason: 'plan_mismatch',
    });
  });

  it('rejects a user mismatch — a webhook crediting a different account than the one that initialized it', () => {
    expect(validatePaymentAgainstIntent(intent, received({ user_id: 'user_2' }))).toEqual({
      ok: false,
      reason: 'user_mismatch',
    });
  });

  it('checks user/plan mismatch before amount, so the most identity-relevant reason surfaces first', () => {
    expect(
      validatePaymentAgainstIntent(intent, received({ user_id: 'user_2', amount: 1 }))
    ).toEqual({ ok: false, reason: 'user_mismatch' });
  });
});
