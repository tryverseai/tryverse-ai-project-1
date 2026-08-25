import { Request, Response, NextFunction } from 'express';
import { normalizeAdminKeyInput, timingSafeStringEqual } from '../lib/adminKey';
import { canonicalConvexProfileUserId } from '../lib/convexProfileId';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { logAudit } from '../services/audit';
import { captureAuthError, Sentry } from '../config/sentry';
import { createConvexClient, anyApi } from '../config/convexHttp';

const LOCAL_AUTH_PREFIX = /^Local\s+/i;

/** Browser-local session (no Convex JWT). Base64 JSON: `{ "sub": string, "email"?: string }`. */
export function parseLocalAuthorizationHeader(
  authHeader: string | undefined
): { id: string; email: string } | null {
  if (!authHeader || !LOCAL_AUTH_PREFIX.test(authHeader)) return null;
  const raw = authHeader.replace(LOCAL_AUTH_PREFIX, '').trim();
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as {
      sub?: unknown;
      email?: unknown;
    };
    if (typeof json.sub !== 'string' || !json.sub.trim()) return null;
    return {
      id: json.sub.trim(),
      email: typeof json.email === 'string' ? json.email.trim() : '',
    };
  } catch {
    return null;
  }
}

/**
 * Verifies identity from `Authorization`:
 * 1. `Local <base64>` when {@link env.ALLOW_LOCAL_SESSION_AUTH}
 * 2. `Bearer <Convex JWT>` via Convex `verifyBearerSession`
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (env.ALLOW_LOCAL_SESSION_AUTH) {
    const local = parseLocalAuthorizationHeader(authHeader);
    if (local) {
      const raw = local.id.trim();
      req.convexAuthSubjectRaw = raw;
      req.user = {
        id: canonicalConvexProfileUserId(raw),
        email: local.email,
      };
      next();
      return;
    }
  }

  if (!authHeader?.startsWith('Bearer ')) {
    logAudit({
      event_type: 'failed_login',
      actor: req.ip ? `ip:${req.ip}` : undefined,
      action: 'missing_auth_header',
      details: { path: req.path },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
    captureAuthError('Missing or invalid authorization header', { path: req.path, ip: req.ip });
    logger.warn('Auth failed: missing or invalid authorization header', {
      path: req.path,
      ip: req.ip,
    });
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  try {
    const client = createConvexClient();
    client.setAuth(token);
    const session = await client.query(anyApi.authSession.verifyBearerSession, {});
    if (!session) {
      logAudit({
        event_type: 'failed_login',
        actor: req.ip ? `ip:${req.ip}` : undefined,
        action: 'invalid_token',
        details: { path: req.path },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      captureAuthError('Invalid or expired token', { path: req.path, ip: req.ip });
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    const rawSubject = String(session.id ?? '').trim();
    req.convexAuthSubjectRaw = rawSubject;

    if (session.is_blocked) {
      logAudit({
        event_type: 'failed_login',
        actor: session.id,
        action: 'account_suspended',
        details: { path: req.path },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
      return;
    }
    req.user = {
      id: canonicalConvexProfileUserId(rawSubject),
      email: session.email || '',
    };
    next();
  } catch (err) {
    const errObj = err instanceof Error ? err : new Error(String(err));
    if (env.SENTRY_DSN) {
      Sentry.captureException(errObj, {
        tags: { feature: 'auth', type: 'auth_middleware_error' },
        extra: { path: req.path },
      });
    }
    logger.error('Auth middleware error', { error: String(err), path: req.path });
    /**
     * Convex JWT verification runs via CONVEX_URL. Mismatch with the app's VITE_CONVEX_URL
     * causes failures here — returning a generic "Authentication service error" made teams
     * chase Resend instead of Railway env.
     */
    res.status(500).json({
      error:
        'Could not verify session with Convex. On Railway (this API), set CONVEX_URL to exactly the same deployment URL as your web app (VITE_CONVEX_URL). Convex → Settings → Deployment URL — no trailing slash. Redeploy the API after changing env.',
      code: 'BEARER_VERIFICATION_FAILED',
    });
  }
}

/**
 * Optional auth — populates req.user if a valid token is present,
 * but does not block the request if absent.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (env.ALLOW_LOCAL_SESSION_AUTH) {
    const local = parseLocalAuthorizationHeader(authHeader);
    if (local) {
      const raw = local.id.trim();
      req.convexAuthSubjectRaw = raw;
      req.user = {
        id: canonicalConvexProfileUserId(raw),
        email: local.email,
      };
      return next();
    }
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }
  try {
    const client = createConvexClient();
    client.setAuth(token);
    const session = await client.query(anyApi.authSession.verifyBearerSession, {});
    if (session && !session.is_blocked) {
      const rawSubject = String(session.id ?? '').trim();
      req.convexAuthSubjectRaw = rawSubject;
      req.user = {
        id: canonicalConvexProfileUserId(rawSubject),
        email: session.email || '',
      };
    } else if (session?.is_blocked) {
      res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' });
      return;
    } else if (env.NODE_ENV !== 'production') {
      logger.warn('optionalAuth: Bearer present but session not verified (check CONVEX_URL matches VITE_CONVEX_URL)', {
        path: req.path,
      });
    }
  } catch (err) {
    if (env.NODE_ENV !== 'production') {
      logger.warn('optionalAuth: bearer verification error', {
        path: req.path,
        error: String(err),
      });
    }
  }
  next();
}

/**
 * Subject string for Convex profile + credit resolution via `findProfileBySubjectKeys` / `insertProfileRow`.
 * Prefer the raw Bearer subject (`accountId|userDocId`) when present so legacy `profiles.id` variants match.
 * Widget traffic uses {@link Request.widgetUserId} only.
 */
export function convexProfileCreditLookupKey(req: Request): string {
  if (req.widgetUserId) return req.widgetUserId.trim();
  return (req.convexAuthSubjectRaw ?? req.user?.id ?? '').trim();
}

/**
 * Requires a logged-in user (JWT) or valid API key context (widgetUserId).
 * Use after optionalApiKey + optionalAuth on routes that must not be anonymous.
 */
export function requireAuthenticatedActor(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.id || req.widgetUserId) {
    next();
    return;
  }
  res.status(401).json({
    error: 'Authentication required. Sign in or provide a valid x-api-key to use this endpoint.',
  });
}

/**
 * Admin-only guard.
 *
 * Checks in order:
 *  1. HttpOnly session cookie (preferred — key never leaves the server)
 *  2. x-admin-key header (backward-compat for CLI / Postman access)
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Import inline to avoid circular dependency (adminSession ↔ auth)
  const { validateAndRefreshSession, parseCookie, ADMIN_SESSION_COOKIE } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../services/adminSession') as typeof import('../services/adminSession');

  const sessionToken = parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (sessionToken) {
    // The admin cookie is SameSite=None (the dashboard is served from tryverseai.com and this API
    // from api.tryverseai.com — different origins, but the SAME registrable site) — browsers
    // attach it on cross-site requests too, and many state-changing admin routes are simple
    // POST/DELETE that don't require a CORS preflight, so CORS alone doesn't stop a malicious page
    // from *sending* one of these with the cookie attached, only from *reading* the response.
    // Sec-Fetch-Site is a browser-set, page-JS-unspoofable header (Fetch Metadata) — reject a
    // cookie-authenticated request whose value shows it did not originate from this site or a
    // same-registrable-domain subdomain of it. A genuine tryverseai.com → api.tryverseai.com
    // request reports 'same-site' (not 'same-origin', since the subdomains differ) — treating
    // 'same-site' as a block was a regression that locked every admin tab out even with a
    // correct key, since only the initial /api/admin/session login (which doesn't require the
    // cookie yet) got through. Requests with no Sec-Fetch-Site at all (older browsers, direct
    // curl/API usage) fall through unaffected; those must use the x-admin-key header path below
    // instead, which needs a custom header a cross-site page can't set without CORS approval —
    // inherently CSRF-safe already.
    const secFetchSite = req.headers['sec-fetch-site'];
    if (
      secFetchSite &&
      secFetchSite !== 'same-origin' &&
      secFetchSite !== 'same-site' &&
      secFetchSite !== 'none'
    ) {
      logAudit({
        event_type: 'failed_login',
        actor: req.ip ? `ip:${req.ip}` : undefined,
        action: 'admin_csrf_blocked',
        details: { path: req.path, secFetchSite },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      res.status(403).json({ error: 'Cross-site request blocked' });
      return;
    }
    if (await validateAndRefreshSession(sessionToken)) {
      next();
      return;
    }
  }

  // Fallback: raw key in header (still accepted for non-browser clients)
  const rawHdr = req.headers['x-admin-key'];
  const first = Array.isArray(rawHdr) ? rawHdr[0] : rawHdr;
  const adminKey = normalizeAdminKeyInput(first);
  if (adminKey && timingSafeStringEqual(adminKey, env.ADMIN_SECRET_KEY)) {
    next();
    return;
  }

  logAudit({
    event_type: 'failed_login',
    actor: req.ip ? `ip:${req.ip}` : undefined,
    action: 'admin_access_denied',
    details: { path: req.path },
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });
  logger.warn('Admin access denied', { path: req.path, ip: req.ip });
  res.status(403).json({ error: 'Admin access required' });
}
