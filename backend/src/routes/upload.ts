import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadImageBuffer, getSignedUrl, INPUT_BUCKET } from '../services/storage/images';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { optionalApiKey } from '../middleware/apiKey';
import { uploadRateLimit } from '../middleware/rateLimiter';
import { logger } from '../config/logger';

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
 * Uploads a person or garment image for try-on.
 * Returns the stored file path (not a URL — use /api/tryon with path).
 *
 * Body: multipart/form-data
 *   - image: File
 *   - type: 'person' | 'garment'
 */
router.post(
  '/',
  uploadRateLimit,
  optionalApiKey,
  optionalAuth,
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
      const type = req.body.type as 'person' | 'product';
      if (!type || !['person', 'product'].includes(type)) {
        res.status(400).json({ error: 'type must be "person" or "product"' });
        return;
      }

      // Map 'product' to storage folder 'garment' (existing bucket structure)
      const storageFolder = type === 'product' ? 'garment' : 'person';
      const userId = (req as Request & { widgetUserId?: string }).widgetUserId || req.user?.id;

      const filePath = await uploadImageBuffer(
        req.file.buffer,
        req.file.mimetype,
        storageFolder as 'person' | 'garment',
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
// Blocklist for SSRF: internal/private IPs, localhost, file protocol
const SSRF_BLOCKED_HOSTS = /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1|\[::\]|0\.0\.0\.0)/i;
const SSRF_BLOCKED_PROTOCOLS = /^(file|ftp|data|gopher|dict):/i;

router.post(
  '/from-url',
  uploadRateLimit,
  optionalApiKey,
  optionalAuth,
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
      if (SSRF_BLOCKED_HOSTS.test(host)) {
        logger.warn('SSRF attempt blocked', { url: url.slice(0, 80), host });
        res.status(400).json({ error: 'URL not allowed' });
        return;
      }
      const response = await fetch(url);
      if (!response.ok) {
        res.status(400).json({ error: 'Failed to fetch image from URL' });
        return;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const mime = contentType.split(';')[0].trim();
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
        res.status(400).json({ error: 'URL must point to JPEG, PNG, or WebP image' });
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
