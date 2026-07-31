import { Router, Request, Response, NextFunction } from 'express';
import { body, matchedData } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { requirePlan } from '../middleware/requirePlan';
import { handleValidationErrors } from '../middleware/validate';
import { generalRateLimit } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import {
  generateAndSaveAiModel,
  listSavedAiModels,
  archiveSavedAiModel,
} from '../services/ai/modelGeneration';
import { generateProductPhotoshoot } from '../services/ai/productPhotoshoot';

const router = Router();

// ─── Generate AI Model (Enterprise) ─────────────────────────────────────────
// Real Replicate wiring, gated end-to-end: requireAuth + requirePlan('enterprise') runs on the
// server regardless of what the frontend shows, matching backend/src/middleware/requirePlan.ts's
// documented pattern. Generation is deliberately NOT invoked in bulk anywhere in this codebase —
// each call is a paying Enterprise customer's own action and consumes real Replicate credits.

router.post(
  '/models/generate',
  generalRateLimit,
  requireAuth,
  requirePlan('enterprise'),
  [
    body('gender').isString().trim().notEmpty(),
    body('skinTone').isString().trim().notEmpty(),
    body('pose').isString().trim().notEmpty(),
    body('age').isString().trim().notEmpty(),
    body('hair').isString().trim().notEmpty(),
    body('background').isString().trim().notEmpty(),
    body('fashionStyle').isString().trim().notEmpty(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const params = matchedData(req) as {
        gender: string;
        skinTone: string;
        pose: string;
        age: string;
        hair: string;
        background: string;
        fashionStyle: string;
      };
      const result = await generateAndSaveAiModel(userId, params);
      res.json(result);
    } catch (err) {
      logger.error('AI model generation failed', { error: err instanceof Error ? err.message : String(err) });
      next(err instanceof AppError ? err : new AppError('Could not generate the AI model right now', 502));
    }
  }
);

router.get(
  '/models',
  requireAuth,
  requirePlan('enterprise'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const models = await listSavedAiModels(req.user!.id);
      res.json({ models });
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/models/:id',
  requireAuth,
  requirePlan('enterprise'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await archiveSavedAiModel(req.user!.id, String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// ─── AI Product Photoshoot (Enterprise) ─────────────────────────────────────
// Flow: brand uploads a product photo (via the existing /api/upload), then picks a model from
// the stock library or their own saved AI-generated models to shoot it on.

router.post(
  '/photoshoot/generate',
  generalRateLimit,
  requireAuth,
  requirePlan('enterprise'),
  [
    body('productStoragePath').isString().trim().notEmpty(),
    body('modelId').isString().trim().notEmpty(),
    body('modelSource').isIn(['library', 'generated']),
    body('background').optional().isString().trim(),
    body('theme').optional().isString().trim(),
    body('lighting').optional().isString().trim(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const params = matchedData(req) as {
        productStoragePath: string;
        modelId: string;
        modelSource: 'library' | 'generated';
        background?: string;
        theme?: string;
        lighting?: string;
      };
      if (!params.productStoragePath.startsWith(`${userId}/`)) {
        throw new AppError('Product image does not belong to this account', 403);
      }
      const result = await generateProductPhotoshoot(userId, params);
      res.json(result);
    } catch (err) {
      logger.error('Product photoshoot failed', { error: err instanceof Error ? err.message : String(err) });
      next(err instanceof AppError ? err : new AppError('Could not generate the photoshoot right now', 502));
    }
  }
);

export default router;
