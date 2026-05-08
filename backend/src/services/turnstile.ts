import { logger } from '../config/logger';

interface SiteverifySuccess {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Validates a Cloudflare Turnstile token server-side.
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstileToken(token: string | undefined, remoteip?: string): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    logger.warn(
      'CLOUDFLARE_TURNSTILE_SECRET_KEY is unset — skipping Turnstile verification (dev only — set in production)'
    );
    return true;
  }
  const raw = typeof token === 'string' ? token.trim() : '';
  if (!raw) {
    return false;
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', raw);
  if (remoteip) body.set('remoteip', remoteip);

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
}
