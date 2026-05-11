import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { getPlanId } from '../services/credits';
import { convexProfileCreditLookupKey } from './auth';
import { logger } from '../config/logger';

/**
 * Plan-based rate limits for try-on endpoint:
 * - Free: 1 request per 10 seconds (6/minute)
 * - Pro (starter, growth): 10 requests per minute
 * - Enterprise: 100 requests per minute
 */
const PLAN_LIMITS: Record<string, { windowSec: number; max: number }> = {
  free: { windowSec: 10, max: 1 },
  starter: { windowSec: 60, max: 10 },
  growth: { windowSec: 60, max: 10 },
  enterprise: { windowSec: 60, max: 100 },
};

// ---------------------------------------------------------------------------
// In-memory fallback used when Redis is unavailable.
// Applies the most conservative limit (free tier) to every identifier so that
// an outage cannot be used to bypass rate limiting.
// ---------------------------------------------------------------------------
const FALLBACK_CONFIG = PLAN_LIMITS.free; // 1 req / 10 s
interface FallbackEntry { count: number; windowStart: number }
const fallbackCounters = new Map<string, FallbackEntry>();

function checkFallbackLimit(identifier: string): boolean {
  const now = Date.now();
  const windowMs = FALLBACK_CONFIG.windowSec * 1000;
  const entry = fallbackCounters.get(identifier);
  if (!entry || now - entry.windowStart > windowMs) {
    fallbackCounters.set(identifier, { count: 1, windowStart: now });
    return true; // allowed
  }
  if (entry.count >= FALLBACK_CONFIG.max) return false; // blocked
  entry.count += 1;
  return true; // allowed
}

// Periodically prune stale fallback entries so the Map does not grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - FALLBACK_CONFIG.windowSec * 1000 * 2;
  for (const [k, v] of fallbackCounters) {
    if (v.windowStart < cutoff) fallbackCounters.delete(k);
  }
}, 60_000);

export async function planAwareTryonRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const identifier = req.user?.id || req.apiKey?.userId || req.ip || 'anon';
  const planId = req.user?.id ? await getPlanId(convexProfileCreditLookupKey(req)) : 'free';
  const config = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
  const key = `tryon:rate:${identifier}`;

  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') {
      // Redis not available — apply conservative in-memory limit instead of failing open
      logger.warn('Redis unavailable for rate-limit check; using in-memory fallback', { identifier });
      if (!checkFallbackLimit(identifier)) {
        res.status(429).json({
          error: 'Too many try-on requests. Please slow down.',
          retryAfter: FALLBACK_CONFIG.windowSec,
        });
        return;
      }
      next();
      return;
    }

    const multi = redis.multi();
    multi.incr(key);
    multi.ttl(key);
    const results = await multi.exec();

    if (!results) {
      if (!checkFallbackLimit(identifier)) {
        res.status(429).json({ error: 'Too many try-on requests. Please slow down.', retryAfter: config.windowSec });
        return;
      }
      next();
      return;
    }

    const count = results[0]?.[1] as number ?? 1;
    const ttl = results[1]?.[1] as number ?? -1;

    if (ttl === -1) {
      await redis.expire(key, config.windowSec);
    }

    if (count > config.max) {
      logger.warn('Rate limit exceeded', {
        identifier,
        planId,
        count,
        limit: config.max,
        windowSec: config.windowSec,
      });
      res.status(429).json({
        error: 'Too many try-on requests. Please slow down.',
        retryAfter: config.windowSec,
      });
      return;
    }

    next();
  } catch (err) {
    // Redis error — apply conservative in-memory limit rather than allowing unlimited traffic
    logger.warn('Rate limit check error; using in-memory fallback', { error: String(err) });
    if (!checkFallbackLimit(identifier)) {
      res.status(429).json({ error: 'Too many try-on requests. Please slow down.', retryAfter: config.windowSec });
      return;
    }
    next();
  }
}
