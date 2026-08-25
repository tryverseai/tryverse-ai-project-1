import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadImageBuffer, getSignedUrl, INPUT_BUCKET } from '../services/storage/images';
import type { StorageFolder } from '../types';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { optionalApiKey, requireScope } from '../middleware/apiKey';
import { uploadRateLimit } from '../middleware/rateLimiter';
import { logger } from '../config/logger';
import { fetchWithSsrfRedirectChecks, MAX_REMOTE_RESPONSE_BYTES } from '../utils/ssrfFetch';
import { isPrivateOrBlockedHost } from '../lib/ssrfGuard';
import { validateImageBuffer } from '../utils/validateImageBuffer';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are accepted'));
    }
  },
});

/**
 * POST /api/upload
 * Uploads a person or product image for try-on.
 * Returns the stored file path (not a URL — use /api/tryon with path).
 *
 * Body: multipart/form-data
 *   - image: File
 *   - type: 'person' | 'product'
 */
router.post(
  '/',
  optionalApiKey,
  requireScope('write'),
  optionalAuth,
  // Must run after the auth middleware above — see tryon.ts for why (its keyGenerator reads
  // req.user/req.apiKey, which don't exist until optionalApiKey/optionalAuth have run).
  uploadRateLimit,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      // 'person' = user/model photo; 'product' = any item to try on
      const rawType = req.body.type;
      if (!rawType || !['person', 'product'].includes(String(rawType))) {
        res.status(400).json({ error: 'type must be "person" or "product"' });
        return;
      }
      const type = rawType as 'person' | 'product';

      // Map 'product' to storage folder 'garment' (existing bucket structure)
      const storageFolder: StorageFolder = type === 'product' ? 'garment' : 'person';
      // widgetUserId is declared on global Express.Request (types/index.ts)
      const userId = req.widgetUserId || req.user?.id;

      let verifiedMime: string;
      try {
        verifiedMime = await validateImageBuffer(req.file.buffer);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid image';
        res.status(400).json({ error: msg });
        return;
      }

      const filePath = await uploadImageBuffer(
        req.file.buffer,
        verifiedMime,
        storageFolder,
        userId
      );

      logger.info('Image uploaded', {
        type,
        filePath,
        userId: req.user?.id || 'anonymous',
        size: req.file.size,
      });

      res.status(201).json({
        success: true,
        filePath,
        type,
        size: req.file.size,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/upload/from-url
 * Fetches an image from a URL and stores it. For widget product images.
 */
const SSRF_BLOCKED_PROTOCOLS = /^(file|ftp|data|gopher|dict):/i;

router.post(
  '/from-url',
  optionalApiKey,
  requireScope('write'),
  optionalAuth,
  // Must run after the auth middleware above — see tryon.ts for why (its keyGenerator reads
  // req.user/req.apiKey, which don't exist until optionalApiKey/optionalAuth have run).
  uploadRateLimit,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        res.status(400).json({ error: 'Valid https image URL required' });
        return;
      }
      if (SSRF_BLOCKED_PROTOCOLS.test(url)) {
        res.status(400).json({ error: 'Invalid URL protocol' });
        return;
      }
      let host: string;
      try {
        host = new URL(url).hostname;
      } catch {
        res.status(400).json({ error: 'Invalid URL' });
        return;
      }
      if (isPrivateOrBlockedHost(host)) {
        logger.warn('SSRF attempt blocked', { url: url.slice(0, 80), host });
        res.status(400).json({ error: 'URL not allowed' });
        return;
      }

      let remoteImage: globalThis.Response;
      try {
        remoteImage = await fetchWithSsrfRedirectChecks(url, isPrivateOrBlockedHost);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Fetch failed';
        logger.warn('Image URL fetch blocked or failed', { url: url.slice(0, 80), msg });
        res.status(400).json({ error: 'Could not fetch image from URL' });
        return;
      }

      if (!remoteImage.ok) {
        res.status(400).json({ error: 'Failed to fetch image from URL' });
        return;
      }

      // Read with a hard cap on body size to prevent OOM from a response
      // that omits or lies about Content-Length.
      const rawBuffer = await remoteImage.arrayBuffer();
      if (rawBuffer.byteLength > MAX_REMOTE_RESPONSE_BYTES) {
        res.status(400).json({ error: 'Remote image exceeds maximum allowed size (10 MB)' });
        return;
      }
      const buffer = Buffer.from(rawBuffer);

      let mime: string;
      try {
        mime = await validateImageBuffer(buffer);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid image';
        res.status(400).json({ error: msg });
        return;
      }
      const userId = (req as Request & { widgetUserId?: string }).widgetUserId || req.user?.id;
      const filePath = await uploadImageBuffer(
        buffer,
        mime,
        'garment',
        userId
      );
      res.status(201).json({ success: true, filePath, type: 'product' });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/upload/signed-url
 * Returns a temporary signed URL for a storage path (for preview).
 * ?path=xxx — path must belong to the authenticated user (ownership check).
 */
router.get(
  '/signed-url',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pathParam = String(req.query.path || '').trim();
      if (!pathParam || pathParam.startsWith('http') || pathParam.includes('..')) {
        res.status(400).json({ error: 'Valid path required' });
        return;
      }
      // Path format: {userId}/person/... or {userId}/garment/... or anonymous/...
      // Enforce: authenticated user may only access their own folder
      const userId = req.user!.id;
      const allowedPrefix = `${userId}/`;
      if (!pathParam.startsWith(allowedPrefix)) {
        logger.warn('Signed URL path ownership violation', {
          path: pathParam,
          userId,
        });
        res.status(403).json({ error: 'Access denied to this path' });
        return;
      }
      const url = await getSignedUrl(INPUT_BUCKET, pathParam, 3600);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
