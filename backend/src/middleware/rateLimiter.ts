import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../config/logger';
import { logAudit } from '../services/audit';
import { Sentry } from '../config/sentry';
import { env } from '../config/env';

const rateLimitResponse = (req: Request, res: Response) => {
  const identifier = (req as Request & { user?: { id: string }; apiKey?: { id: string; userId: string } }).user?.id
    || (req as Request & { apiKey?: { id: string } }).apiKey?.id
    || req.ip;
  logAudit({
    event_type: 'rate_limit',
    actor: typeof identifier === 'string' ? identifier : `ip:${req.ip}`,
    action: 'rate_limit_exceeded',
    details: { path: req.path, ip: req.ip },
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  });
  logger.warn('Rate limit exceeded', {
    path: req.path,
    ip: req.ip,
    identifier,
  });
  if (env.SENTRY_DSN) {
    Sentry.captureMessage('Rate limit exceeded', {
      level: 'warning',
      tags: { feature: 'rate_limit', environment: env.NODE_ENV },
      extra: { path: req.path, ip: req.ip, identifier },
    });
  }
  res.status(429).json({
    error: 'Too many requests. Please slow down.',
    retryAfter: 60,
  });
};

// General API rate limit — 100 requests per minute
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  /** CORS preflight must not consume quota or return 429 without ACAO. */
  skip: (req) => req.method === 'OPTIONS',
  handler: rateLimitResponse,
});

// Try-on endpoint — expensive AI calls: 20 per minute per IP
export const tryonRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate-limit by user ID if available, else by IP
    return req.user?.id || req.apiKey?.userId || req.ip || 'unknown';
  },
  handler: rateLimitResponse,
});

// Upload endpoint — 30 uploads per minute.
// Key order: authenticated user ID → widget API key ID (multi-tenant) → IP.
// Using API key ID for widget traffic ensures each merchant gets their own
// bucket instead of sharing a single IP limit with all their shoppers.
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.apiKey?.id || req.ip || 'unknown',
  handler: rateLimitResponse,
});

// Payment endpoints — 10 requests per minute (anti-abuse)
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});

// Public early-access form — tight limit per IP
export const earlyAccessRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});

/** Public contact / support form */
export const supportContactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});

// Auth endpoints — 10 per 15 minutes (brute force protection)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});

// Widget requests — 60 per minute per API key
export const widgetRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.apiKey?.id || req.ip || 'unknown',
  handler: rateLimitResponse,
});

/** Invite link validation — public GET */
export const inviteValidateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});

/** Invite lifecycle completion after signup */
export const inviteCompleteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitResponse,
});
