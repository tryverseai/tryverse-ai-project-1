/**
 * Personalized Model Cache
 *
 * Caches generated personalization results so the same (session, product)
 * pair never calls the AI model twice.
 *
 * Key: personalize:cache:{sessionId}:{productHash}
 * TTL: 7 days (matching session lifetime)
 *
 * Fields:
 *   - sessionId
 *   - productHash (SHA-256 of productImageUrl)
 *   - resultPath  (storage path of generated image)
 *   - createdAt
 *   - expiresAt
 */

import crypto from 'crypto';
import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const CACHE_PREFIX = 'personalize:cache:';

export interface PersonalizeCache {
  sessionId: string;
  productHash: string;
  resultPath: string;
  originalImageUrl: string;
  createdAt: number;
  expiresAt: number;
}

export function hashProductUrl(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 32);
}

function cacheKey(sessionId: string, productHash: string): string {
  return `${CACHE_PREFIX}${sessionId}:${productHash}`;
}

export async function getCachedPersonalization(
  sessionId: string,
  productImageUrl: string
): Promise<PersonalizeCache | null> {
  const productHash = hashProductUrl(productImageUrl);
  const key = cacheKey(sessionId, productHash);

  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') return null;
    const raw = await redis.get(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as PersonalizeCache;
    if (Date.now() > entry.expiresAt) {
      await redis.del(key);
      return null;
    }
    logger.info('Personalize cache hit', { sessionId, productHash });
    return entry;
  } catch (err) {
    logger.warn('Redis read for personalize cache failed', { error: String(err) });
    return null;
  }
}

export async function setCachedPersonalization(
  sessionId: string,
  productImageUrl: string,
  resultPath: string
): Promise<PersonalizeCache> {
  const productHash = hashProductUrl(productImageUrl);
  const key = cacheKey(sessionId, productHash);
  const now = Date.now();
  const entry: PersonalizeCache = {
    sessionId,
    productHash,
    resultPath,
    originalImageUrl: productImageUrl,
    createdAt: now,
    expiresAt: now + CACHE_TTL_SECONDS * 1000,
  };

  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(entry));
      logger.info('Personalize result cached', { sessionId, productHash });
    }
  } catch (err) {
    logger.warn('Redis write for personalize cache failed', { error: String(err) });
  }

  return entry;
}

/** Count how many personalized images exist for a session (analytics). */
export async function countSessionGenerations(sessionId: string): Promise<number> {
  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') return 0;
    const keys = await redis.keys(`${CACHE_PREFIX}${sessionId}:*`);
    return keys.length;
  } catch {
    return 0;
  }
}
