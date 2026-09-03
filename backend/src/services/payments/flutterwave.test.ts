import { describe, it, expect, vi } from 'vitest';

// vi.mock factories are hoisted above every other top-level statement in this file, including
// const declarations — referencing an outer const from inside one throws a TDZ error at import
// time. The literal is duplicated here deliberately; WEBHOOK_SECRET below is only for test bodies.
vi.mock('../../config/env', () => ({
  env: {
    FLUTTERWAVE_SECRET_KEY: 'FLWSECK_test-xxx',
    FLUTTERWAVE_WEBHOOK_SECRET: 'test-flutterwave-webhook-secret',
    FRONTEND_URL: 'https://tryverseai.com',
  },
}));
vi.mock('../../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../config/convexHttp', () => ({
  anyApi: {},
  convexMutationTrusted: vi.fn(),
  convexQueryTrusted: vi.fn(),
}));
vi.mock('../billingConvexBridge', () => ({
  insertPaymentIfNew: vi.fn(),
  insertPaymentIntent: vi.fn(),
  getPaymentIntentByReference: vi.fn(),
  upsertSubscriptionRow: vi.fn(),
  cancelSubscriptionsForUserId: vi.fn(),
}));
vi.mock('../credits', () => ({ allocateCredits: vi.fn() }));
vi.mock('../creditsConvexBridge', () => ({ cxGetPlan: vi.fn(), cxGetProfile: vi.fn() }));
vi.mock('../tryonConvexBridge', () => ({ cxInsertUsageEvent: vi.fn() }));
vi.mock('../email', () => ({ sendPaymentConfirmationEmail: vi.fn(), sendFailedPaymentEmail: vi.fn() }));

import { validateFlutterwaveSignature } from './flutterwave';

const WEBHOOK_SECRET = 'test-flutterwave-webhook-secret';

describe('validateFlutterwaveSignature', () => {
  it('accepts a header that matches the configured secret exactly', () => {
    expect(validateFlutterwaveSignature('{}', WEBHOOK_SECRET)).toBe(true);
  });

  it('rejects a header that does not match the configured secret', () => {
    expect(validateFlutterwaveSignature('{}', 'a-completely-wrong-hash')).toBe(false);
  });

  it('rejects a missing verif-hash header without throwing', () => {
    expect(() => validateFlutterwaveSignature('{}', '')).not.toThrow();
    expect(validateFlutterwaveSignature('{}', '')).toBe(false);
  });

  it('rejects a header of a different length without throwing', () => {
    // crypto.timingSafeEqual throws on unequal buffer lengths — must never let that escape.
    expect(() => validateFlutterwaveSignature('{}', 'x')).not.toThrow();
    expect(validateFlutterwaveSignature('{}', 'x')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(validateFlutterwaveSignature('{}', WEBHOOK_SECRET.toUpperCase())).toBe(false);
  });

  it('is not fooled by the payload content — this is a direct secret comparison, not an HMAC over the payload', () => {
    // validateFlutterwaveSignature deliberately ignores its payload argument (Flutterwave's
    // documented mechanism is comparing the raw configured secret, not signing the body) — a
    // tampered payload with a correct header must still validate, and that's correct, not a bug.
    expect(validateFlutterwaveSignature('{"tampered":true}', WEBHOOK_SECRET)).toBe(true);
  });
});
