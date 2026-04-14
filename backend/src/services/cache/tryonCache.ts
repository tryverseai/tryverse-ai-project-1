import crypto from 'crypto';
import { getRedisClient } from '../../config/redis';
import { logger } from '../../config/logger';
import type { ProductCategory } from '../../types';

/**
 * CACHING LAYER — Repeat Try-On Results
 *
 * Cache key: tryon:{personHash}:{productHash}:{category}[:variant]
 * Optional `variant` (e.g. idm vs fashn vs flux for clothing) avoids serving the wrong engine output.
 * Identical image combinations return cached result — no AI inference.
 * TTL: 24 hours (reduces AI costs for popular products).
 *
 * Two-tier storage:
 *  1. In-memory Map (always active) — survives Redis downtime, instant lookup
 *  2. Redis (when available)        — survives server restarts, shared across workers
 */

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
const CACHE_PREFIX = 'tryon:';

// ── In-memory fallback cache ──────────────────────────────────────────────────
/** Maximum number of entries kept in memory (oldest evicted when exceeded). */
const MEM_CACHE_MAX = 500;

interface MemCacheEntry {
  resultPath: string;
  expiresAt: number;
}

const memCache = new Map<string, MemCacheEntry>();

/** Remove all expired entries. Called lazily on each write. */
function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of memCache) {
    if (entry.expiresAt <= now) memCache.delete(key);
  }
}

/** Evict the oldest entry when the cache is full. */
function evictOldest(): void {
  const oldest = memCache.keys().next().value;
  if (oldest) memCache.delete(oldest);
}

function memGet(key: string): string | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memCache.delete(key);
    return null;
  }
  return entry.resultPath;
}

function memSet(key: string, resultPath: string): void {
  evictExpired();
  if (memCache.size >= MEM_CACHE_MAX) evictOldest();
  memCache.set(key, { resultPath, expiresAt: Date.now() + CACHE_TTL_MS });
}

function memDel(key: string): void {
  memCache.delete(key);
}

/**
 * Computes SHA-256 hash of image buffer for cache key.
 */
export function computeImageHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Builds cache key from image content hashes.
 */
export function buildCacheKey(
  personImageHash: string,
  productImageHash: string,
  category: ProductCategory,
  variant?: string
): string {
  const v = variant ? `:${variant}` : '';
  return `${CACHE_PREFIX}${personImageHash}:${productImageHash}:${category}${v}`;
}

/**
 * Looks up a cached result. Checks in-memory store first, then Redis.
 * Returns the stored result path or null on a cache miss.
 */
export async function getCachedResultByHash(
  personImageHash: string,
  productImageHash: string,
  category: ProductCategory,
  variant?: string
): Promise<string | null> {
  const key = buildCacheKey(personImageHash, productImageHash, category, variant);

  // 1. Check in-memory cache (always available, even without Redis)
  const memHit = memGet(key);
  if (memHit) {
    logger.info('Cache hit (memory)', { key: key.slice(-24) });
    return memHit;
  }

  // 2. Check Redis when available
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      const redisHit = await redis.get(key);
      if (redisHit) {
        // Warm the memory cache so the next hit is instant
        memSet(key, redisHit);
        logger.info('Cache hit (redis)', { key: key.slice(-24) });
        return redisHit;
      }
    }
  } catch (err) {
    logger.warn('Redis cache lookup failed', { error: String(err) });
  }

  return null;
}

/**
 * Stores a try-on result in both the in-memory cache and Redis (when available).
 */
export async function setCachedResultByHash(
  personImageHash: string,
  productImageHash: string,
  category: ProductCategory,
  resultPath: string,
  variant?: string
): Promise<void> {
  const key = buildCacheKey(personImageHash, productImageHash, category, variant);

  // Always write to memory cache
  memSet(key, resultPath);
  logger.info('Result cached (memory)', { key: key.slice(-24), ttl: CACHE_TTL_SECONDS });

  // Also write to Redis when available
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.setex(key, CACHE_TTL_SECONDS, resultPath);
      logger.info('Result cached (redis)', { key: key.slice(-24) });
    }
  } catch (err) {
    logger.warn('Redis cache write failed', { error: String(err) });
  }
}


/**
 * Invalidates a cached result from both memory and Redis.
 */
export async function invalidateCacheEntry(
  personImageHash: string,
  productImageHash: string,
  category: ProductCategory,
  variant?: string
): Promise<void> {
  const key = buildCacheKey(personImageHash, productImageHash, category, variant);
  memDel(key);
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.del(key);
    }
    logger.info('Cache invalidated', { key: key.slice(-24) });
  } catch (err) {
    logger.warn('Cache invalidation failed', { error: String(err) });
  }
}

/**
 * Returns cache statistics for admin dashboard.
 */
export async function getCacheStats(): Promise<{ keys: number; memoryMb: number } | null> {
  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') return null;

    const [keyCount, memInfo] = await Promise.all([
      redis.dbsize(),
      redis.info('memory'),
    ]);

    const memMatch = memInfo.match(/used_memory:(\d+)/);
    const memBytes = memMatch ? parseInt(memMatch[1], 10) : 0;
    return { keys: keyCount, memoryMb: Math.round(memBytes / 1024 / 1024) };
  } catch {
    return null;
  }
}

/**
 * Deletes all `tryon:*` result cache keys from memory and Redis.
 * Does not touch Bull queue keys.
 */
export async function clearAllTryonResultCache(): Promise<number> {
  // Clear all in-memory try-on entries
  let memCount = 0;
  for (const key of memCache.keys()) {
    if (key.startsWith(CACHE_PREFIX)) {
      memCache.delete(key);
      memCount++;
    }
  }

  let redisCount = 0;
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      const keys = await redis.keys(`${CACHE_PREFIX}*`);
      if (keys.length) {
        redisCount = await redis.del(...keys);
      }
    }
  } catch (err) {
    logger.warn('Try-on Redis cache clear failed', { error: String(err) });
  }

  const total = memCount + redisCount;
  logger.info('Try-on result cache cleared', { memCount, redisCount, total });
  return total;
}
