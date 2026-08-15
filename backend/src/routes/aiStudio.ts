import { Router, Request, Response, NextFunction } from 'express';
import { body, matchedData } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { requirePlan } from '../middleware/requirePlan';
import { handleValidationErrors } from '../middleware/validate';
import { generalRateLimit } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { anyApi, convexQueryTrusted, convexMutationTrusted } from '../config/convexHttp';
import { getSignedUrl, INPUT_BUCKET, RESULT_BUCKET } from '../services/storage/images';
import {
  generateAndSaveAiModel,
  listSavedAiModels,
  archiveSavedAiModel,
} from '../services/ai/modelGeneration';
import { generateProductPhotoshoot, resolveModelUrl } from '../services/ai/productPhotoshoot';
import { validateOutfitSlots, type OutfitSlots } from '../services/ai/outfitSlots';
import { buildOutfitPrompt } from '../services/ai/outfitPrompt';
import { enqueueOutfitJob } from '../services/queue/outfitProducer';
import type { OutfitJob } from '../types';

const router = Router();

/** Resolves a product's `image_url` (may be an external URL or an internal storage path) to a fetchable HTTPS URL. */
async function resolveProductImageUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('http')) return imageUrl;
  return getSignedUrl(INPUT_BUCKET, imageUrl);
}

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

// ─── Outfit Builder (Enterprise) ────────────────────────────────────────────
// Composites the brand's selected products (top+bottom-or-one-piece, optional shoes/outerwear)
// into one flat-lay image, then runs FASHN Try-On Max on it — the same mechanism proven by hand
// (multiple garments combined into one picture-frame image + a prompt), not multiple API inputs.
// Async/queued (its own `outfit-jobs` Bull queue, isolated from `tryon-jobs`) since Try-On Max can
// take as long as the existing single-garment FASHN path (up to POLL_TIMEOUT_MS), which is too
// long to hold open a synchronous HTTP request/proxy connection for.

const OUTFIT_SLOT_FIELDS = ['top', 'bottom', 'one_piece', 'shoes', 'outerwear'] as const;

router.post(
  '/outfit/generate',
  generalRateLimit,
  requireAuth,
  requirePlan('enterprise'),
  [
    body('modelId').isString().trim().notEmpty(),
    body('modelSource').isIn(['library', 'generated']),
    body('slots').isObject(),
    ...OUTFIT_SLOT_FIELDS.map((f) => body(`slots.${f}`).optional().isString().trim().notEmpty()),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const params = matchedData(req) as {
        modelId: string;
        modelSource: 'library' | 'generated';
        slots: Partial<Record<(typeof OUTFIT_SLOT_FIELDS)[number], string>>;
      };

      const slotValidation = validateOutfitSlots(params.slots);
      if (!slotValidation.valid) {
        throw new AppError(slotValidation.error || 'Invalid outfit combination', 400);
      }

      const productIds = Object.values(params.slots).filter((v): v is string => Boolean(v));
      const products = await convexQueryTrusted<Array<{ id: string; name: string; image_url: string | null }>>(
        anyApi.backendTrusted.getProductsForOutfit,
        { secret: env.BACKEND_SHARED_SECRET, userId, productIds }
      );
      const productsById = new Map(products.map((p) => [p.id, p]));

      const slotImageUrls: OutfitSlots = {};
      const slotLabels: Partial<Record<(typeof OUTFIT_SLOT_FIELDS)[number], string>> = {};
      for (const field of OUTFIT_SLOT_FIELDS) {
        const productId = params.slots[field];
        if (!productId) continue;
        const product = productsById.get(productId);
        if (!product || !product.image_url) {
          throw new AppError(`Product not found for "${field}"`, 404);
        }
        slotImageUrls[field] = await resolveProductImageUrl(product.image_url);
        slotLabels[field] = product.name;
      }

      const modelImageUrl = await resolveModelUrl(userId, params.modelId, params.modelSource);
      const prompt = buildOutfitPrompt(slotLabels);

      const { id: outfitDbId } = (await convexMutationTrusted(anyApi.backendTrusted.insertOutfitGeneration, {
        secret: env.BACKEND_SHARED_SECRET,
        userId,
        modelImage: modelImageUrl,
        slots: slotImageUrls,
        promptUsed: prompt,
      })) as { id: string };

      const jobId = `outfit_${outfitDbId}_${Date.now()}`;
      const job: OutfitJob = {
        jobId,
        userId,
        outfitDbId,
        modelImageUrl,
        slotImageUrls,
        slotLabels,
      };
      await enqueueOutfitJob(job);

      res.status(202).json({ outfitId: outfitDbId, jobId, status: 'processing' });
    } catch (err) {
      logger.error('Outfit generation failed', { error: err instanceof Error ? err.message : String(err) });
      next(err instanceof AppError ? err : new AppError('Could not start the outfit generation right now', 502));
    }
  }
);

router.get(
  '/outfit/:outfitId',
  requireAuth,
  requirePlan('enterprise'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const outfitId = String(req.params.outfitId);

      const outfit = await convexQueryTrusted<{
        id: string;
        status: string;
        resultImage: string | null;
        error: string | null;
        createdAt: string;
        completedAt: string | null;
      } | null>(anyApi.backendTrusted.getOutfitGenerationForUser, {
        secret: env.BACKEND_SHARED_SECRET,
        userId,
        id: outfitId,
      });

      if (!outfit) {
        res.status(404).json({ error: 'Outfit generation not found' });
        return;
      }

      let resultUrl: string | null = null;
      if (outfit.status === 'completed' && outfit.resultImage) {
        resultUrl = await getSignedUrl(RESULT_BUCKET, outfit.resultImage);
      }

      res.json({
        outfitId: outfit.id,
        status: outfit.status,
        resultUrl,
        error: outfit.error ?? undefined,
        createdAt: outfit.createdAt,
        completedAt: outfit.completedAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
