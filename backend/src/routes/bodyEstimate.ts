import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { body, matchedData } from 'express-validator';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { optionalApiKey } from '../middleware/apiKey';
import { uploadRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { validateImageBuffer } from '../utils/validateImageBuffer';
import { estimateBodyFromImage } from '../services/ai/bodyEstimate';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are accepted'));
  },
});

/**
 * POST /api/body-estimate
 * Best-effort body-shape / build / suggested-size estimate from a single full-body photo.
 * This is proportion-based (pose keypoints), NOT a tailoring measurement — a single 2D image
 * has no depth information, so precise chest/waist/hip circumferences are not returned; see
 * backend/src/services/ai/bodyEstimate.ts for the full explanation. Every response carries a
 * visible confidence level.
 *
 * Body: multipart/form-data
 *   - image: File (required)
 *   - heightCm: number (optional — improves the suggested size band; never inferred from the photo)
 */
router.post(
  '/',
  uploadRateLimit,
  optionalApiKey,
  optionalAuth,
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err) => (err ? next(err) : next()));
  },
  [body('heightCm').optional().isFloat({ min: 100, max: 230 }).toFloat()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }
      await validateImageBuffer(req.file.buffer);

      const { heightCm } = matchedData(req) as { heightCm?: number };
      const result = await estimateBodyFromImage(req.file.buffer, heightCm);
      res.json(result);
    } catch (err) {
      logger.error('Body estimate failed', { error: err instanceof Error ? err.message : String(err) });
      next(err instanceof AppError ? err : new AppError('Could not analyze this photo', 500));
    }
  }
);

export default router;
