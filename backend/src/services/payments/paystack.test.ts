import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

// vi.mock factories are hoisted above every other top-level statement in this file, including
// const declarations — referencing an outer const from inside one throws a TDZ error at import
// time. The literal is duplicated here deliberately; WEBHOOK_SECRET below is only for test bodies.
vi.mock('../../config/env', () => ({
  env: {
    PAYSTACK_SECRET_KEY: 'sk_test_xxx',
    PAYSTACK_WEBHOOK_SECRET: 'test-paystack-webhook-secret',
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
  upsertSubscriptionRow: vi.fn(),
  cancelSubscriptionsForUserId: vi.fn(),
}));
vi.mock('../credits', () => ({ allocateCredits: vi.fn() }));
vi.mock('../creditsConvexBridge', () => ({ cxGetPlan: vi.fn(), cxGetProfile: vi.fn() }));
vi.mock('../tryonConvexBridge', () => ({ cxInsertUsageEvent: vi.fn() }));
vi.mock('../email', () => ({ sendPaymentConfirmationEmail: vi.fn(), sendFailedPaymentEmail: vi.fn() }));

import { validatePaystackSignature } from './paystack';

const WEBHOOK_SECRET = 'test-paystack-webhook-secret';

function signPayload(payload: string, secret = WEBHOOK_SECRET): string {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex');
}

describe('validatePaystackSignature', () => {
  it('accepts a correctly signed payload', () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } });
    expect(validatePaystackSignature(payload, signPayload(payload))).toBe(true);
  });

  it('rejects a payload signed with the wrong secret', () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } });
    expect(validatePaystackSignature(payload, signPayload(payload, 'wrong-secret'))).toBe(false);
  });

  it('rejects a tampered payload signed against the original', () => {
    const original = JSON.stringify({ event: 'charge.success', data: { amount: 1000 } });
    const tampered = JSON.stringify({ event: 'charge.success', data: { amount: 999999 } });
    expect(validatePaystackSignature(tampered, signPayload(original))).toBe(false);
  });

  it('rejects a missing signature without throwing', () => {
    const payload = JSON.stringify({ event: 'charge.success' });
    expect(() => validatePaystackSignature(payload, '')).not.toThrow();
    expect(validatePaystackSignature(payload, '')).toBe(false);
  });

  it('rejects a signature of a completely different length without throwing', () => {
    const payload = JSON.stringify({ event: 'charge.success' });
    expect(() => validatePaystackSignature(payload, 'short')).not.toThrow();
    expect(validatePaystackSignature(payload, 'short')).toBe(false);
  });
});
