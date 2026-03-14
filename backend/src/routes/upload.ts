import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { uploadImageBuffer, getSignedUrl, INPUT_BUCKET } from '../services/storage/images';
import { optionalAuth } from '../middleware/auth';
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
router.post(
  '/from-url',
  uploadRateLimit,
  optionalApiKey,
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        res.status(400).json({ error: 'Valid image URL required' });
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
 * ?path=xxx
 */
router.get(
  '/signed-url',
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const path = req.query.path as string;
      if (!path || path.startsWith('http')) {
        res.status(400).json({ error: 'Valid path required' });
        return;
      }
      const url = await getSignedUrl(INPUT_BUCKET, path, 3600);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
