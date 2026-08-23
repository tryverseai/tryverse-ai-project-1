/**
 * POST /api/personalize/session          — create shopper session (upload reference photo)
 * GET  /api/personalize/session/:id      — validate/retrieve session
 * POST /api/personalize/generate         — generate personalized model image
 * GET  /api/personalize/analytics        — brand analytics (JWT auth)
 * DELETE /api/personalize/session/:id   — revoke session
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { requireApiKey, validateDomain } from '../middleware/apiKey';
import { requireAuth } from '../middleware/auth';
import { widgetRateLimit } from '../middleware/rateLimiter';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { generatePersonalizedModel, isPersonalizationEnabled } from '../services/ai/personalization';
import {
  createShopperSession,
  getShopperSession,
  deleteShopperSession,
} from '../services/personalizeSession';
import {
  getCachedPersonalization,
  setCachedPersonalization,
  countSessionGenerations,
} from '../services/personalizeCache';
import { uploadImageBuffer } from '../services/storage/images';
import { getSignedUrl, RESULT_BUCKET } from '../services/storage/images';
import { getRedisClient } from '../config/redis';

const router = Router();

// Multer: memory storage, 10 MB max, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

/** Check that personalization is enabled; return 503 if not. */
function requirePersonalizationEnabled(res: Response): boolean {
  if (!isPersonalizationEnabled()) {
    res.status(503).json({
      error: 'AI Model Personalization is not enabled on this server.',
    });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/personalize/session
// Create a shopper session by uploading a reference photo.
// Requires: API key + domain validation.
// Returns: { sessionId, expiresAt }
// ---------------------------------------------------------------------------
router.post(
  '/session',
  widgetRateLimit,
  requireApiKey,
  validateDomain,
  upload.single('reference'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!requirePersonalizationEnabled(res)) return;

    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'reference image is required (multipart field "reference")' });
        return;
      }

      // Validate and normalize the reference image
      let normalizedBuffer: Buffer;
      try {
        normalizedBuffer = await sharp(file.buffer)
          .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer();
      } catch {
        res.status(400).json({ error: 'Could not process the uploaded image. Please try another photo.' });
        return;
      }

      // Store the reference photo
      const userId = req.widgetUserId!;
      const referenceImagePath = await uploadImageBuffer(
        normalizedBuffer,
        'image/jpeg',
        'person',
        userId
      );

      const session = await createShopperSession(userId, referenceImagePath);

      logger.info('Personalize session created via API', {
        sessionId: session.sessionId,
        userId,
      });

      res.status(201).json({
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/personalize/session/:sessionId
// Validate a session without generating anything.
// Returns: { valid: true, expiresAt } or 404
// ---------------------------------------------------------------------------
router.get(
  '/session/:sessionId',
  widgetRateLimit,
  requireApiKey,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = String(req.params.sessionId);
      const session = await getShopperSession(sessionId);

      if (!session) {
        res.status(404).json({ error: 'Session not found or expired' });
        return;
      }

      // Ensure session belongs to this API key owner
      if (session.apiKeyId !== req.widgetUserId!) {
        res.status(403).json({ error: 'Session does not belong to this API key' });
        return;
      }

      res.json({ valid: true, sessionId: session.sessionId, expiresAt: session.expiresAt });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/personalize/generate
// Generate a personalized version of a product image.
// Requires: API key + valid session.
// Body: { sessionId, productImageUrl, productId? }
// Returns: { resultUrl, cached: boolean, durationMs? }
// ---------------------------------------------------------------------------
router.post(
  '/generate',
  widgetRateLimit,
  requireApiKey,
  validateDomain,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!requirePersonalizationEnabled(res)) return;

    try {
      const body = req.body as Record<string, unknown>;
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
      const productImageUrl = typeof body.productImageUrl === 'string' ? body.productImageUrl.trim() : '';

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }
      if (!productImageUrl) {
        res.status(400).json({ error: 'productImageUrl is required' });
        return;
      }

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(productImageUrl);
      } catch {
        res.status(400).json({ error: 'productImageUrl is not a valid URL' });
        return;
      }
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        res.status(400).json({ error: 'productImageUrl must use HTTP or HTTPS' });
        return;
      }

      // Load session
      const session = await getShopperSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found or expired. Please upload a new reference photo.' });
        return;
      }
      if (session.apiKeyId !== req.widgetUserId!) {
        res.status(403).json({ error: 'Session does not belong to this API key' });
        return;
      }

      // Cache check
      const cached = await getCachedPersonalization(sessionId, productImageUrl);
      if (cached) {
        const resultUrl = await getSignedUrl(RESULT_BUCKET, cached.resultPath);
        res.json({ resultUrl, cached: true });
        return;
      }

      // Reference image URL from storage
      const referenceUrl = await getSignedUrl(RESULT_BUCKET, session.referenceImagePath);

      // Generate
      const output = await generatePersonalizedModel({
        productImageUrl,
        referenceImageUrl: referenceUrl,
        userId: session.apiKeyId,
      });

      // Cache result
      await setCachedPersonalization(sessionId, productImageUrl, output.resultPath);

      // Track analytics event via Redis counter (simple approach)
      try {
        const redis = getRedisClient();
        if (redis.status === 'ready') {
          const today = new Date().toISOString().slice(0, 10);
          await redis.incr(`personalize:analytics:${session.apiKeyId}:generations:${today}`);
          await redis.expire(`personalize:analytics:${session.apiKeyId}:generations:${today}`, 90 * 24 * 3600);
        }
      } catch { /* non-critical */ }

      const resultUrl = await getSignedUrl(RESULT_BUCKET, output.resultPath);

      res.json({
        resultUrl,
        cached: false,
        durationMs: output.durationMs,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/personalize/session/:sessionId
// Revoke a shopper session (e.g. on sign-out from brand store).
// ---------------------------------------------------------------------------
router.delete(
  '/session/:sessionId',
  widgetRateLimit,
  requireApiKey,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = String(req.params.sessionId);
      const session = await getShopperSession(sessionId);
      if (session && session.apiKeyId !== req.widgetUserId!) {
        res.status(403).json({ error: 'Session does not belong to this API key' });
        return;
      }
      await deleteShopperSession(sessionId);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/personalize/analytics
// Returns personalization usage stats for the authenticated brand.
// Requires: Convex JWT (dashboard use).
// ---------------------------------------------------------------------------
router.get(
  '/analytics',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? '30'), 10)));

      // Read daily counters from Redis
      const redis = getRedisClient();
      const stats: { date: string; generations: number }[] = [];
      let totalGenerations = 0;

      if (redis.status === 'ready') {
        for (let i = 0; i < days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          const key = `personalize:analytics:${userId}:generations:${dateStr}`;
          const val = await redis.get(key);
          const count = val ? parseInt(val, 10) : 0;
          stats.push({ date: dateStr, generations: count });
          totalGenerations += count;
        }
      }

      stats.reverse(); // oldest first

      res.json({
        totalGenerations,
        days,
        enabled: isPersonalizationEnabled(),
        dailyBreakdown: stats,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
