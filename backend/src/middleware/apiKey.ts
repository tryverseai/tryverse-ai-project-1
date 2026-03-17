import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import type { ApiKeyPayload } from '../types';

/**
 * Optionally resolves API key. Does not fail if missing.
 * Sets req.apiKey and req.widgetUserId when key is valid.
 */
export async function optionalApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const keyValue = (req.headers['x-api-key'] as string) || (req.query.api_key as string);
  if (!keyValue) return next();

  try {
    const { data: apiKey, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, user_id, key_value, status')
      .eq('key_value', keyValue)
      .eq('status', 'active')
      .single();

    if (!error && apiKey) {
      req.apiKey = { id: apiKey.id, userId: apiKey.user_id, keyValue: apiKey.key_value, status: apiKey.status } as ApiKeyPayload;
      req.widgetUserId = apiKey.user_id;
    }
  } catch { /* ignore */ }
  next();
}

/**
 * Authenticates requests via API key (x-api-key header or query param).
 * Used for widget and external brand integrations.
 * Sets req.apiKey and req.widgetUserId on success.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Prefer header over query: query params may appear in logs, referrers
  const keyValue =
    (req.headers['x-api-key'] as string) ||
    (req.query.api_key as string);

  if (req.query.api_key && !req.headers['x-api-key']) {
    logger.warn('API key passed via query string; prefer x-api-key header', { path: req.path });
  }

  if (!keyValue) {
    res.status(401).json({ error: 'API key required. Provide via x-api-key header.' });
    return;
  }

  try {
    const { data: apiKey, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, user_id, key_value, status, name')
      .eq('key_value', keyValue)
      .eq('status', 'active')
      .single();

    if (error || !apiKey) {
      res.status(401).json({ error: 'Invalid or revoked API key' });
      return;
    }

    // Update last_used_at asynchronously (non-blocking)
    void supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKey.id)
      .then(() => {}, (err: unknown) => logger.error('Failed to update last_used_at', { error: String(err) }));

    req.apiKey = {
      id: apiKey.id,
      userId: apiKey.user_id,
      keyValue: apiKey.key_value,
      status: apiKey.status,
      name: apiKey.name,
    } as ApiKeyPayload;

    req.widgetUserId = apiKey.user_id;
    next();
  } catch (err) {
    logger.error('API key middleware error', { error: String(err) });
    res.status(500).json({ error: 'API key validation failed' });
  }
}

/**
 * Validates that the request origin domain is in the allowed domains
 * for the provided API key.
 */
export async function validateDomain(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.apiKey) {
    res.status(401).json({ error: 'API key authentication required before domain check' });
    return;
  }

  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) {
    // Allow requests without origin header (server-to-server)
    return next();
  }

  try {
    let requestDomain = '';
    try {
      const url = new URL(origin);
      requestDomain = url.hostname.replace(/^www\./, '');
    } catch {
      requestDomain = origin.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
    }

    const { data: allowedDomains } = await supabaseAdmin
      .from('allowed_domains')
      .select('domain')
      .eq('api_key_id', req.apiKey.id);

    if (!allowedDomains || allowedDomains.length === 0) {
      // No domain restrictions configured — allow all
      return next();
    }

    const isAllowed = allowedDomains.some((d) => {
      const allowed = d.domain.replace(/^www\./, '').replace(/^https?:\/\//, '');
      return requestDomain === allowed || requestDomain.endsWith(`.${allowed}`);
    });

    if (!isAllowed) {
      logger.warn('Domain not allowed for API key', { domain: requestDomain, apiKeyId: req.apiKey.id });
      res.status(403).json({ error: `Domain ${requestDomain} is not authorized for this API key` });
      return;
    }

    next();
  } catch (err) {
    logger.error('Domain validation error', { error: String(err) });
    res.status(500).json({ error: 'Domain validation failed' });
  }
}
