import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { logAudit } from '../services/audit';
import type { ApiKeyPayload } from '../types';
import { convexMutationTrusted, convexQueryTrusted, anyApi } from '../config/convexHttp';

function apiKeyFromQueryAllowed(): boolean {
  return env.NODE_ENV !== 'production' || env.ALLOW_API_KEY_IN_QUERY;
}

function resolveApiKeyValue(req: Request): string | undefined {
  const header = (req.headers['x-api-key'] as string) || undefined;
  const query = typeof req.query.api_key === 'string' ? req.query.api_key : undefined;
  if (header) return header;
  if (!apiKeyFromQueryAllowed()) return undefined;
  return query;
}

/**
 * Optionally resolves API key. Does not fail if missing.
 * Sets req.apiKey and req.widgetUserId when key is valid.
 */
export async function optionalApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const keyValue = resolveApiKeyValue(req);
  if (!keyValue) return next();

  try {
    const apiKey = await convexQueryTrusted<{
      id: string;
      userId: string;
      keyValue: string;
      status: string;
      name: string;
    } | null>(anyApi.backendTrusted.lookupActiveApiKey, {
      secret: env.BACKEND_SHARED_SECRET,
      keyValue,
    });

    if (apiKey) {
      req.apiKey = {
        id: apiKey.id,
        userId: apiKey.userId,
        keyValue: apiKey.keyValue,
        status: apiKey.status,
        name: apiKey.name,
      } as ApiKeyPayload;
      req.widgetUserId = apiKey.userId;
    }
  } catch {
    /* ignore */
  }
  next();
}

/**
 * Authenticates requests via API key (x-api-key header; query param only in dev or if ALLOW_API_KEY_IN_QUERY).
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!apiKeyFromQueryAllowed() && req.query.api_key) {
    res.status(400).json({
      error: 'Do not pass API keys in the URL. Use the x-api-key header.',
    });
    return;
  }

  if (apiKeyFromQueryAllowed() && req.query.api_key && !req.headers['x-api-key']) {
    logger.warn('API key passed via query string; prefer x-api-key header', { path: req.path });
  }

  const keyValue = resolveApiKeyValue(req);

  if (!keyValue) {
    res.status(401).json({ error: 'API key required. Provide via x-api-key header.' });
    return;
  }

  try {
    const apiKey = await convexQueryTrusted<{
      id: string;
      userId: string;
      keyValue: string;
      status: string;
      name: string;
    } | null>(anyApi.backendTrusted.lookupActiveApiKey, {
      secret: env.BACKEND_SHARED_SECRET,
      keyValue,
    });

    if (!apiKey) {
      res.status(401).json({ error: 'Invalid or revoked API key' });
      return;
    }

    void convexMutationTrusted(anyApi.backendTrusted.markApiKeyUsed, {
      secret: env.BACKEND_SHARED_SECRET,
      keyValue,
    }).then(
      () => {},
      (err: unknown) => logger.error('Failed to update last_used_at', { error: String(err) })
    );

    req.apiKey = {
      id: apiKey.id,
      userId: apiKey.userId,
      keyValue: apiKey.keyValue,
      status: apiKey.status,
      name: apiKey.name,
    } as ApiKeyPayload;

    req.widgetUserId = apiKey.userId;
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

    const allowedDomains = await convexQueryTrusted<Array<{ domain: string }>>(
      anyApi.backendTrusted.listAllowedDomainsForApiKey,
      {
        secret: env.BACKEND_SHARED_SECRET,
        apiKeyId: req.apiKey.id,
      }
    );

    if (!allowedDomains || allowedDomains.length === 0) {
      return next();
    }

    const isAllowed = allowedDomains.some((d) => {
      const allowed = d.domain.replace(/^www\./, '').replace(/^https?:\/\//, '');
      return requestDomain === allowed || requestDomain.endsWith(`.${allowed}`);
    });

    if (!isAllowed) {
      const { logAudit } = await import('../services/audit');
      logAudit({
        event_type: 'api_key_blocked',
        actor: `api_key:${req.apiKey.id}`,
        action: 'domain_not_allowed',
        target_id: req.apiKey.id,
        details: { domain: requestDomain, apiKeyId: req.apiKey.id },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
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
