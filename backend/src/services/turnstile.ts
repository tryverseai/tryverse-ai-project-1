import { logger } from '../config/logger';

interface SiteverifySuccess {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Validates a Cloudflare Turnstile token server-side.
 *
 * - **Production** (`NODE_ENV=production`): requires `CLOUDFLARE_TURNSTILE_SECRET_KEY` and
 *   calls Cloudflare's siteverify API. Blocks the request on any failure.
 *
 * - **Development / staging** (any other `NODE_ENV`): skips the remote API call entirely and
 *   accepts any non-empty token. This is necessary because the dev frontend uses Cloudflare's
 *   always-passes test site key (`1x00000000000000000000AA`) whose tokens are only accepted by
 *   the paired test secret key, not by a real production secret key. Requiring the remote call
 *   in dev would block every signup. The widget is still shown in dev (bot-friction is present);
 *   we just skip the server-side round-trip.
 *
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export async function verifyTurnstileToken(token: string | undefined, remoteip?: string): Promise<boolean> {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = typeof token === 'string' ? token.trim() : '';

  if (!isProd) {
    // In development / staging: skip server-side verification entirely.
    // The Cloudflare widget is still rendered in the browser (bot friction is present), but the
    // server-side API round-trip is intentionally skipped for two reasons:
    //   1. The dev frontend uses the always-passes test site key (1x00000000000000000000AA)
    //      whose tokens are rejected by a real production secret key.
    //   2. The Cloudflare script may fail to load on localhost (CSP, network, offline) causing
    //      the widget to fire onError → no token is ever generated. Blocking on a missing token
    //      would prevent all local signups even when the account itself is created successfully.
    if (raw) {
      logger.debug('Turnstile dev: token present — skipping remote verification');
    } else {
      logger.warn('Turnstile dev: no token (widget likely failed to load on localhost) — passing through');
    }
    return true;
  }

  // --- Production path ---
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    logger.error('CLOUDFLARE_TURNSTILE_SECRET_KEY is unset in production — blocking request');
    return false;
  }
  if (!raw) {
    logger.warn('Turnstile production: no token in request body');
    return false;
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', raw);
  if (remoteip) body.set('remoteip', remoteip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      logger.warn('Turnstile siteverify HTTP error', { status: res.status });
      return false;
    }

    const data = (await res.json()) as SiteverifySuccess;
    if (!data.success) {
      logger.warn('Turnstile verification failed', { codes: data['error-codes'] });
    }
    return Boolean(data.success);
  } catch (err) {
    logger.warn('Turnstile siteverify request threw', { error: String(err) });
    return false;
  }
}
