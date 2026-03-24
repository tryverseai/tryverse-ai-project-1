import { Router, Request, Response, NextFunction } from 'express';
import { body, matchedData } from 'express-validator';
import { optionalAuth } from '../middleware/auth';
import { optionalApiKey } from '../middleware/apiKey';
import { handleValidationErrors } from '../middleware/validate';
import { listActiveModels, resolveModelToPersonPath } from '../services/models/modelLibrary';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/models
 * Public catalog for Try-On Studio and transparency (no secrets).
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    const models = await listActiveModels();
    res.json({ models });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/models/person-path
 * Copies a library model image into the caller's storage as a person shot.
 * Auth: Bearer (dashboard) OR x-api-key (widget).
 */
router.post(
  '/person-path',
  optionalApiKey,
  optionalAuth,
  [body('modelId').isUUID().withMessage('modelId must be a UUID')],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id || req.widgetUserId;
      if (!userId) {
        res.status(401).json({ error: 'Sign in or provide a valid API key' });
        return;
      }
      const validated = matchedData(req) as { modelId: string };
      const modelId = validated.modelId;
      const filePath = await resolveModelToPersonPath(modelId, userId);
      res.status(201).json({ success: true, filePath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found') || msg.includes('inactive')) {
        res.status(404).json({ error: msg });
        return;
      }
      logger.error('models/person-path failed', { error: msg });
      next(err);
    }
  }
);

export default router;
