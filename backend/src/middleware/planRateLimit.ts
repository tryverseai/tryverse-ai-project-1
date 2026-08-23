import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { getPlanId } from '../services/credits';
import { convexProfileCreditLookupKey } from './auth';
import { logger } from '../config/logger';
import { envAwareLimit } from '../config/env';

interface PlanLimitConfig {
  windowSec: number;
  max: number;
}

/**
 * Redis-backed, plan-aware rate limiter factory. Unlike the plain `express-rate-limit` instances
 * in `rateLimiter.ts` (in-memory, IP/key-only), this reads the caller's actual plan tier and
 * applies a per-plan pace — critically including a real cap for "unlimited" (-1 total credits)
 * plans, which the credit system itself never throttles at all (an unlimited plan's `checkCredits`
 * always returns `allowed: true` with no decrement). Falls back to the most conservative (free)
 * limit, applied in-memory, whenever Redis is unavailable — an outage must never be usable to
 * bypass rate limiting by failing open.
 */
export function createPlanAwareRateLimit(opts: {
  /** Redis key prefix and fallback-map namespace — must be unique per feature. */
  feature: string;
  /** Per-plan-tier limits; anything not listed here (including unknown/future plan ids) uses `limits.free`. */
  limits: Record<string, PlanLimitConfig>;
  /** Response body's error message. */
  message: string;
}) {
  const { feature, limits, message } = opts;
  const fallbackConfig = limits.free;
  const fallbackCounters = new Map<string, { count: number; windowStart: number }>();

  function checkFallbackLimit(identifier: string): boolean {
    const now = Date.now();
    const windowMs = fallbackConfig.windowSec * 1000;
    const entry = fallbackCounters.get(identifier);
    if (!entry || now - entry.windowStart > windowMs) {
      fallbackCounters.set(identifier, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= fallbackConfig.max) return false;
    entry.count += 1;
    return true;
  }

  setInterval(() => {
    const cutoff = Date.now() - fallbackConfig.windowSec * 1000 * 2;
    for (const [k, v] of fallbackCounters) {
      if (v.windowStart < cutoff) fallbackCounters.delete(k);
    }
  }, 60_000);

  return async function planAwareRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    const identifier = req.user?.id || req.apiKey?.userId || req.ip || 'anon';
    const planId = req.user?.id ? await getPlanId(convexProfileCreditLookupKey(req)) : 'free';
    const config = limits[planId] ?? limits.free;
    const key = `${feature}:rate:${identifier}`;

    try {
      const redis = getRedisClient();
      if (redis.status !== 'ready') {
        logger.warn('Redis unavailable for rate-limit check; using in-memory fallback', { identifier, feature });
        if (!checkFallbackLimit(identifier)) {
          res.status(429).json({ error: message, retryAfter: fallbackConfig.windowSec });
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
          res.status(429).json({ error: message, retryAfter: config.windowSec });
          return;
        }
        next();
        return;
      }

      const count = (results[0]?.[1] as number) ?? 1;
      const ttl = (results[1]?.[1] as number) ?? -1;

      if (ttl === -1) {
        await redis.expire(key, config.windowSec);
      }

      if (count > config.max) {
        logger.warn('Rate limit exceeded', { identifier, planId, feature, count, limit: config.max, windowSec: config.windowSec });
        res.status(429).json({ error: message, retryAfter: config.windowSec });
        return;
      }

      next();
    } catch (err) {
      logger.warn('Rate limit check error; using in-memory fallback', { error: String(err), feature });
      if (!checkFallbackLimit(identifier)) {
        res.status(429).json({ error: message, retryAfter: config.windowSec });
        return;
      }
      next();
    }
  };
}

/**
 * Try-on: Free 6/min, Pro (starter/growth) 10/min, Enterprise 100/min.
 * `max` is environment-aware (see envAwareLimit) — production keeps these exact numbers;
 * development/test get a generous multiple so testing the Free plan repeatedly doesn't mean
 * waiting out a 1-req/10s limit meant for real shoppers.
 */
export const planAwareTryonRateLimit = createPlanAwareRateLimit({
  feature: 'tryon',
  limits: {
    free: { windowSec: 10, max: envAwareLimit(1) },
    starter: { windowSec: 60, max: envAwareLimit(10) },
    growth: { windowSec: 60, max: envAwareLimit(10) },
    enterprise: { windowSec: 60, max: envAwareLimit(100) },
  },
  message: 'Too many try-on requests. Please slow down.',
});

/**
 * AI Studio (Outfit Builder, AI Model Studio, Product Photography, AI Photoshoot, AI Video):
 * more conservative than try-on since several of these chain multiple FASHN calls per request
 * (Photoshoot: 2; Video: real per-credit provider cost) — real FASHN COGS that an unlimited/
 * enterprise plan's credit check (`monthly_credits_total === -1`) never throttles at all today.
 */
export const planAwareAiStudioRateLimit = createPlanAwareRateLimit({
  feature: 'ai-studio',
  limits: {
    free: { windowSec: 30, max: envAwareLimit(1) },
    starter: { windowSec: 60, max: envAwareLimit(6) },
    growth: { windowSec: 60, max: envAwareLimit(6) },
    enterprise: { windowSec: 60, max: envAwareLimit(30) },
  },
  message: 'Too many generation requests. Please slow down.',
});
