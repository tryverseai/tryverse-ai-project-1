import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';

// auth.ts pulls in env validation / winston / sentry / convex-http at import time — stub the
// side-effectful config modules so this stays a pure unit test of the guard's branching logic.
// vi.mock calls are hoisted above the import below (same approach as payments/paystack.test.ts).
vi.mock('../config/env', () => ({ env: { ALLOW_LOCAL_SESSION_AUTH: false, NODE_ENV: 'test', SENTRY_DSN: '' } }));
vi.mock('../config/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../config/sentry', () => ({ Sentry: { captureException: vi.fn() }, captureAuthError: vi.fn() }));
vi.mock('../services/audit', () => ({ logAudit: vi.fn() }));
vi.mock('../config/convexHttp', () => ({ createConvexClient: vi.fn(), anyApi: {} }));

import { requireAuthenticatedActor } from './auth';

interface MockRes {
  statusCode: number;
  body: unknown;
  status(code: number): MockRes;
  json(payload: unknown): MockRes;
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe('requireAuthenticatedActor', () => {
  it('rejects a request with no JWT user and no API-key actor (anonymous upload / from-url)', () => {
    const req = { headers: {} } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireAuthenticatedActor(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: expect.stringContaining('Authentication required') });
  });

  it('allows a request carrying a server-verified JWT actor (req.user.id set by optionalAuth)', () => {
    const req = { headers: {}, user: { id: 'account-1|user-1', email: 'brand@example.com' } } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireAuthenticatedActor(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('allows a request carrying a valid API-key actor (req.widgetUserId set by optionalApiKey)', () => {
    const req = { headers: {}, widgetUserId: 'owning-business-user-id' } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireAuthenticatedActor(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });

  it('rejects when the resolved actor id is an empty string (invalid / unverified credential)', () => {
    const req = { headers: {}, user: { id: '' }, widgetUserId: '' } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    requireAuthenticatedActor(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
