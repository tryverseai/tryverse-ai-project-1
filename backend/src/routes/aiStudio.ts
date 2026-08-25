import { Router, Request, Response, NextFunction } from 'express';
import { body, matchedData } from 'express-validator';
import { requireAuth, convexProfileCreditLookupKey } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { generalRateLimit } from '../middleware/rateLimiter';
import { planAwareAiStudioRateLimit } from '../middleware/planRateLimit';
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
import { cxGetTryonForUser } from '../services/tryonConvexBridge';
import { validateOutfitSlots, type OutfitSlots } from '../services/ai/outfitSlots';
import { buildOutfitPrompt } from '../services/ai/outfitPrompt';
import { enqueueOutfitJob, getOutfitQueue } from '../services/queue/outfitProducer';
import { enqueueProductModelJob, getProductModelQueue } from '../services/queue/productModelProducer';
import { enqueueVideoJob, getVideoQueue } from '../services/queue/videoProducer';
import { executeOutfitPipeline } from '../services/ai/outfitPipeline';
import { executeProductModelPipeline } from '../services/ai/productModelPipeline';
import { executeVideoPipeline } from '../services/ai/videoPipeline';
import { checkCredits, restoreCredits, getPlanId, CREDIT_COSTS, videoCreditCost } from '../services/credits';
import type { OutfitJob, ProductModelJob, VideoJob } from '../types';

const router = Router();

/**
 * Reserves `amount` TryVerse credits for an AI-generation request. All four generators here
 * (Model Studio, Photoshoot, Outfit, Video) share this gate instead of the old Enterprise-only
 * plan check — access is now metered by credits (available on every plan, including Free) rather
 * than locked to one tier. Throws a 402 AppError with the reason on insufficient credits.
 */
async function reserveGenerationCredits(req: Request, amount: number): Promise<'monthly' | 'free'> {
  const userId = convexProfileCreditLookupKey(req);
  const result = await checkCredits(userId, amount);
  if (!result.allowed) {
    throw new AppError(result.reason || 'Not enough credits for this generation', 402, 'INSUFFICIENT_CREDITS');
  }
  return result.creditType;
}

/** AI Video is not available on the Free plan (enforced server-side, not just hidden in the UI). */
async function blockFreePlanVideo(req: Request): Promise<void> {
  const userId = convexProfileCreditLookupKey(req);
  const planId = await getPlanId(userId);
  if (planId === 'free') {
    throw new AppError(
      'AI Video requires a paid plan. Upgrade in Billing to unlock video generation.',
      403,
      'VIDEO_REQUIRES_UPGRADE'
    );
  }
}

/** Resolves a product's `image_url` (may be an external URL or an internal storage path) to a fetchable HTTPS URL. */
async function resolveProductImageUrl(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('http')) return imageUrl;
  return getSignedUrl(INPUT_BUCKET, imageUrl);
}

// ─── Generate AI Model ───────────────────────────────────────────────────────
// Metered by credits (CREDIT_COSTS.aiModel) rather than plan-gated — available on every plan,
// including Free, self-limited by each plan's credit pool. Server-side credit check runs
// regardless of what the frontend shows.

router.post(
  '/models/generate',
  generalRateLimit,
  requireAuth,
  planAwareAiStudioRateLimit,
  [body('prompt').isString().trim().notEmpty().isLength({ max: 500 })],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    let creditType: 'monthly' | 'free' | undefined;
    try {
      creditType = await reserveGenerationCredits(req, CREDIT_COSTS.aiModel);
      const params = matchedData(req) as { prompt: string };
      const result = await generateAndSaveAiModel(userId, params);
      res.json(result);
    } catch (err) {
      logger.error('AI model generation failed', { error: err instanceof Error ? err.message : String(err) });
      if (err instanceof AppError) {
        if (err.code !== 'INSUFFICIENT_CREDITS') await restoreCredits(userId, CREDIT_COSTS.aiModel, creditType);
        next(err);
        return;
      }
      await restoreCredits(userId, CREDIT_COSTS.aiModel, creditType);
      next(new AppError('Could not generate the AI model right now', 502));
    }
  }
);

router.get(
  '/models',
  requireAuth,
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
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await archiveSavedAiModel(req.user!.id, String(req.params.id));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// ─── AI Product Photoshoot ───────────────────────────────────────────────────
// Flow: brand uploads a product photo (via the existing /api/upload), then picks a model from
// the stock library or their own saved AI-generated models to shoot it on. Metered by credits,
// available on every plan.

router.post(
  '/photoshoot/generate',
  generalRateLimit,
  requireAuth,
  planAwareAiStudioRateLimit,
  [
    body('productStoragePath').isString().trim().notEmpty(),
    body('modelId').isString().trim().notEmpty().isLength({ max: 200 }),
    body('modelSource').isIn(['library', 'generated']),
    body('background').optional().isString().trim().isLength({ max: 300 }),
    body('theme').optional().isString().trim().isLength({ max: 300 }),
    body('lighting').optional().isString().trim().isLength({ max: 300 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    let creditType: 'monthly' | 'free' | undefined;
    try {
      creditType = await reserveGenerationCredits(req, CREDIT_COSTS.photoshoot);
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
      if (err instanceof AppError) {
        if (err.code !== 'INSUFFICIENT_CREDITS') await restoreCredits(userId, CREDIT_COSTS.photoshoot, creditType);
        next(err);
        return;
      }
      await restoreCredits(userId, CREDIT_COSTS.photoshoot, creditType);
      next(new AppError('Could not generate the photoshoot right now', 502));
    }
  }
);

// ─── Outfit Builder ──────────────────────────────────────────────────────────
// Composites the brand's selected products (top+bottom-or-one-piece, optional shoes/outerwear)
// into one flat-lay image, then runs FASHN Try-On Max on it — the same mechanism proven by hand
// (multiple garments combined into one picture-frame image + a prompt), not multiple API inputs.
// Async/queued (its own `outfit-jobs` Bull queue, isolated from `tryon-jobs`) since Try-On Max can
// take as long as the existing single-garment FASHN path (up to POLL_TIMEOUT_MS), which is too
// long to hold open a synchronous HTTP request/proxy connection for. Metered by credits, available
// on every plan.

const OUTFIT_SLOT_FIELDS = ['top', 'bottom', 'one_piece', 'shoes', 'outerwear', 'eyewear', 'jewelry'] as const;

router.post(
  '/outfit/generate',
  generalRateLimit,
  requireAuth,
  planAwareAiStudioRateLimit,
  [
    body('modelId').isString().trim().notEmpty().isLength({ max: 200 }),
    body('modelSource').isIn(['library', 'generated']),
    body('slots').isObject(),
    ...OUTFIT_SLOT_FIELDS.map((f) => body(`slots.${f}`).optional().isString().trim().notEmpty().isLength({ max: 200 })),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    const creditAmount = CREDIT_COSTS.outfit;
    let creditsReserved = false;
    let creditType: 'monthly' | 'free' | undefined;
    try {
      creditType = await reserveGenerationCredits(req, creditAmount);
      creditsReserved = true;

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
        creditAmount,
        creditType,
        modelImageUrl,
        slotImageUrls,
        slotLabels,
      };

      // Same graceful degradation as the main try-on flow (tryOnOrchestrator.ts): if Redis/Bull
      // isn't available, run the pipeline inline rather than 502ing the request. Outfit
      // generation self-persists its own Convex state either way (see outfitPipeline.ts), so
      // running it here vs. in the worker is otherwise identical.
      if (getOutfitQueue()) {
        try {
          await enqueueOutfitJob(job);
          res.status(202).json({ outfitId: outfitDbId, jobId, status: 'processing' });
          return;
        } catch (enqueueErr) {
          logger.warn('Outfit generation: enqueue failed, falling back to sync', {
            jobId,
            outfitDbId,
            error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
          });
        }
      }

      logger.info('Outfit generation: processing synchronously (queue unavailable)', { jobId, outfitDbId });
      const result = await executeOutfitPipeline(job);
      if (result.status === 'completed' && result.resultUrl) {
        try {
          const resultUrl = await getSignedUrl(RESULT_BUCKET, result.resultUrl);
          res.json({ outfitId: outfitDbId, jobId, status: 'completed', resultUrl });
          return;
        } catch (signErr) {
          // Generation already succeeded and was already billed — a signing failure here must not
          // fall into the catch block below and refund credits for completed work. The client can
          // recover the result via GET /outfit/:outfitId, which re-signs on read.
          logger.error('Outfit generation: completed but signing the result URL failed', {
            outfitDbId,
            error: signErr instanceof Error ? signErr.message : String(signErr),
          });
          res.json({ outfitId: outfitDbId, jobId, status: 'completed' });
          return;
        }
      }
      res.json({ outfitId: outfitDbId, jobId, status: result.status, error: result.error });
    } catch (err) {
      logger.error('Outfit generation failed', { error: err instanceof Error ? err.message : String(err) });
      // Job was never queued/run (failed before reaching the pipeline) — the pipeline handles
      // its own restore once a job actually starts running, so only restore here.
      if (creditsReserved) await restoreCredits(userId, creditAmount, creditType);
      next(err instanceof AppError ? err : new AppError('Could not start the outfit generation right now', 502));
    }
  }
);

router.get(
  '/outfit/:outfitId',
  requireAuth,
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

// ─── AI Model Studio ─────────────────────────────────────────────────────────
// Uploads a flat-lay/ghost-mannequin product photo and generates a professional on-model shot via
// FASHN product-to-model. Unlike AI Product Photoshoot (product + a specific saved model photo),
// this generates the person itself — optionally guided by a face reference for identity. Async/
// queued (its own `product-model-jobs` queue), same reasoning as the Outfit Builder above. Metered
// by credits; face reference costs more (matches FASHN's own +3-credit identity-lock surcharge).

router.post(
  '/product-model/generate',
  generalRateLimit,
  requireAuth,
  planAwareAiStudioRateLimit,
  [
    body('productStoragePath').isString().trim().notEmpty(),
    body('faceReferenceStoragePath').optional().isString().trim().notEmpty(),
    body('prompt').optional().isString().trim().isLength({ max: 500 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    const params = matchedData(req) as {
      productStoragePath: string;
      faceReferenceStoragePath?: string;
      prompt?: string;
    };
    const creditAmount = params.faceReferenceStoragePath
      ? CREDIT_COSTS.photoshootFaceRef
      : CREDIT_COSTS.photoshoot;
    let creditsReserved = false;
    let creditType: 'monthly' | 'free' | undefined;
    try {
      creditType = await reserveGenerationCredits(req, creditAmount);
      creditsReserved = true;

      if (!params.productStoragePath.startsWith(`${userId}/`)) {
        throw new AppError('Product image does not belong to this account', 403);
      }
      if (params.faceReferenceStoragePath && !params.faceReferenceStoragePath.startsWith(`${userId}/`)) {
        throw new AppError('Face reference image does not belong to this account', 403);
      }

      const productImageUrl = await getSignedUrl(INPUT_BUCKET, params.productStoragePath);
      const faceReferenceUrl = params.faceReferenceStoragePath
        ? await getSignedUrl(INPUT_BUCKET, params.faceReferenceStoragePath)
        : undefined;

      const { id: generationDbId } = (await convexMutationTrusted(anyApi.backendTrusted.insertProductModelGeneration, {
        secret: env.BACKEND_SHARED_SECRET,
        userId,
        productImage: productImageUrl,
        faceReference: faceReferenceUrl,
        promptUsed: params.prompt,
      })) as { id: string };

      const jobId = `product_model_${generationDbId}_${Date.now()}`;
      const job: ProductModelJob = {
        jobId,
        userId,
        creditAmount,
        creditType,
        generationDbId,
        productImageUrl,
        faceReferenceUrl,
        prompt: params.prompt,
      };

      // Same graceful degradation as the main try-on flow — run inline when Redis/Bull isn't
      // available instead of failing the request. See outfit route above for the full rationale.
      if (getProductModelQueue()) {
        try {
          await enqueueProductModelJob(job);
          res.status(202).json({ generationId: generationDbId, jobId, status: 'processing' });
          return;
        } catch (enqueueErr) {
          logger.warn('AI Model Studio: enqueue failed, falling back to sync', {
            jobId,
            generationDbId,
            error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
          });
        }
      }

      logger.info('AI Model Studio: processing synchronously (queue unavailable)', { jobId, generationDbId });
      const result = await executeProductModelPipeline(job);
      if (result.status === 'completed' && result.resultUrl) {
        try {
          const resultUrl = await getSignedUrl(RESULT_BUCKET, result.resultUrl);
          res.json({ generationId: generationDbId, jobId, status: 'completed', resultUrl });
          return;
        } catch (signErr) {
          // Generation already succeeded and was already billed — a signing failure here must not
          // fall into the catch block below and refund credits for completed work. The client can
          // recover the result via GET /product-model/:id, which re-signs on read.
          logger.error('AI Model Studio: completed but signing the result URL failed', {
            generationDbId,
            error: signErr instanceof Error ? signErr.message : String(signErr),
          });
          res.json({ generationId: generationDbId, jobId, status: 'completed' });
          return;
        }
      }
      res.json({ generationId: generationDbId, jobId, status: result.status, error: result.error });
    } catch (err) {
      logger.error('AI Model Studio generation failed', { error: err instanceof Error ? err.message : String(err) });
      if (creditsReserved) await restoreCredits(userId, creditAmount, creditType);
      next(err instanceof AppError ? err : new AppError('Could not start generation right now', 502));
    }
  }
);

router.get(
  '/product-model/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const id = String(req.params.id);

      const generation = await convexQueryTrusted<{
        id: string;
        status: string;
        resultImage: string | null;
        error: string | null;
        createdAt: string;
        completedAt: string | null;
      } | null>(anyApi.backendTrusted.getProductModelGenerationForUser, {
        secret: env.BACKEND_SHARED_SECRET,
        userId,
        id,
      });

      if (!generation) {
        res.status(404).json({ error: 'Generation not found' });
        return;
      }

      let resultUrl: string | null = null;
      if (generation.status === 'completed' && generation.resultImage) {
        resultUrl = await getSignedUrl(RESULT_BUCKET, generation.resultImage);
      }

      res.json({
        generationId: generation.id,
        status: generation.status,
        resultUrl,
        error: generation.error ?? undefined,
        createdAt: generation.createdAt,
        completedAt: generation.completedAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── AI Video ─────────────────────────────────────────────────────────────────
// Animates a still image (any upload — a try-on result, a photoshoot/outfit result the brand
// downloaded and re-uploaded, or any product image) into a short clip via FASHN image-to-video.
// Not available on the Free plan (enforced server-side below, not just hidden in the UI). Real
// per-credit cost (480p=1, 720p=2, 1080p=3 at 5s; x2 at 10s) — own isolated `video-jobs` queue.

router.post(
  '/video/generate',
  generalRateLimit,
  requireAuth,
  planAwareAiStudioRateLimit,
  [
    // Exactly one source: a fresh upload, an existing try-on result, or a saved/library AI model.
    body('sourceStoragePath').optional().isString().trim().notEmpty(),
    body('tryonId').optional().isString().trim().notEmpty(),
    body('modelId').optional().isString().trim().notEmpty().isLength({ max: 200 }),
    body('modelSource').optional().isIn(['library', 'generated']),
    body('prompt').optional().isString().trim().isLength({ max: 200 }),
    body('duration').optional().isIn([5, 10]),
    body('resolution').optional().isIn(['480p', '720p', '1080p']),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.id;
    const params = matchedData(req) as {
      sourceStoragePath?: string;
      tryonId?: string;
      modelId?: string;
      modelSource?: 'library' | 'generated';
      prompt?: string;
      duration?: 5 | 10;
      resolution?: '480p' | '720p' | '1080p';
    };
    const duration = params.duration ?? 5;
    const resolution = params.resolution ?? '1080p';
    const creditAmount = videoCreditCost(resolution, duration);
    let creditsReserved = false;
    let creditType: 'monthly' | 'free' | undefined;
    try {
      await blockFreePlanVideo(req);
      creditType = await reserveGenerationCredits(req, creditAmount);
      creditsReserved = true;

      const sourceCount = [params.sourceStoragePath, params.tryonId, params.modelId].filter(Boolean).length;
      if (sourceCount !== 1) {
        throw new AppError('Provide exactly one of sourceStoragePath, tryonId, or modelId', 400);
      }

      let sourceImageUrl: string;
      if (params.sourceStoragePath) {
        if (!params.sourceStoragePath.startsWith(`${userId}/`)) {
          throw new AppError('Source image does not belong to this account', 403);
        }
        sourceImageUrl = await getSignedUrl(INPUT_BUCKET, params.sourceStoragePath);
      } else if (params.tryonId) {
        // "Generate video from a try-on result" — animate a completed try-on's own result image.
        const tryon = await cxGetTryonForUser(params.tryonId, userId);
        if (!tryon) {
          throw new AppError('Try-on not found', 404);
        }
        if (tryon.status !== 'completed' || !tryon.result_image) {
          throw new AppError('This try-on has no completed result yet', 400);
        }
        sourceImageUrl = await getSignedUrl(RESULT_BUCKET, tryon.result_image);
      } else {
        // "Generate campaign video" — animate a saved AI model (library stock or the brand's own).
        if (!params.modelSource) {
          throw new AppError('modelSource is required when modelId is provided', 400);
        }
        sourceImageUrl = await resolveModelUrl(userId, params.modelId!, params.modelSource);
      }

      const { id: generationDbId } = (await convexMutationTrusted(anyApi.backendTrusted.insertVideoGeneration, {
        secret: env.BACKEND_SHARED_SECRET,
        userId,
        sourceImage: sourceImageUrl,
        promptUsed: params.prompt,
        durationSeconds: duration,
        resolution,
      })) as { id: string };

      const jobId = `video_${generationDbId}_${Date.now()}`;
      const job: VideoJob = {
        jobId,
        userId,
        generationDbId,
        creditAmount,
        creditType,
        sourceImageUrl,
        prompt: params.prompt,
        duration,
        resolution,
      };

      // Same graceful degradation as the main try-on flow — run inline when Redis/Bull isn't
      // available instead of failing the request. See outfit route above for the full rationale.
      if (getVideoQueue()) {
        try {
          await enqueueVideoJob(job);
          res.status(202).json({ generationId: generationDbId, jobId, status: 'processing' });
          return;
        } catch (enqueueErr) {
          logger.warn('AI Video: enqueue failed, falling back to sync', {
            jobId,
            generationDbId,
            error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
          });
        }
      }

      logger.info('AI Video: processing synchronously (queue unavailable)', { jobId, generationDbId });
      const result = await executeVideoPipeline(job);
      if (result.status === 'completed' && result.resultUrl) {
        try {
          const resultUrl = await getSignedUrl(RESULT_BUCKET, result.resultUrl);
          res.json({ generationId: generationDbId, jobId, status: 'completed', resultUrl });
          return;
        } catch (signErr) {
          // Generation already succeeded and was already billed — a signing failure here must not
          // fall into the catch block below and refund credits for completed work. The client can
          // recover the result via GET /video/:id, which re-signs on read.
          logger.error('AI Video: completed but signing the result URL failed', {
            generationDbId,
            error: signErr instanceof Error ? signErr.message : String(signErr),
          });
          res.json({ generationId: generationDbId, jobId, status: 'completed' });
          return;
        }
      }
      res.json({ generationId: generationDbId, jobId, status: result.status, error: result.error });
    } catch (err) {
      logger.error('AI Video generation failed', { error: err instanceof Error ? err.message : String(err) });
      if (creditsReserved) await restoreCredits(userId, creditAmount, creditType);
      next(err instanceof AppError ? err : new AppError('Could not start video generation right now', 502));
    }
  }
);

router.get(
  '/video/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const id = String(req.params.id);

      const generation = await convexQueryTrusted<{
        id: string;
        status: string;
        resultVideo: string | null;
        error: string | null;
        createdAt: string;
        completedAt: string | null;
      } | null>(anyApi.backendTrusted.getVideoGenerationForUser, {
        secret: env.BACKEND_SHARED_SECRET,
        userId,
        id,
      });

      if (!generation) {
        res.status(404).json({ error: 'Generation not found' });
        return;
      }

      let resultUrl: string | null = null;
      if (generation.status === 'completed' && generation.resultVideo) {
        resultUrl = await getSignedUrl(RESULT_BUCKET, generation.resultVideo);
      }

      res.json({
        generationId: generation.id,
        status: generation.status,
        resultUrl,
        error: generation.error ?? undefined,
        createdAt: generation.createdAt,
        completedAt: generation.completedAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
