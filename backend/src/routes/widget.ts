import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { requireApiKey, validateDomain } from '../middleware/apiKey';
import { listActiveModels } from '../services/models/modelLibrary';
import { widgetRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { checkCredits, SHOPPER_TRYON_UNAVAILABLE_MESSAGE } from '../services/credits';
import { env } from '../config/env';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../config/convexHttp';
import {
  cxInsertTryon,
  cxGetTryonForUser,
} from '../services/tryonConvexBridge';
import { enqueueTryOnJob, getTryOnQueue } from '../services/queue/producer';
import { executeTryOnPipeline } from '../services/ai/pipeline';
import { getSignedUrl, RESULT_BUCKET } from '../services/storage/images';
import { logger } from '../config/logger';
import type { TryOnJob, ProductCategory } from '../types';

const VALID_CATEGORIES: ProductCategory[] = ['clothing', 'bags', 'glasses'];

const router = Router();

/**
 * POST /api/widget/request
 * The main widget try-on endpoint.
 * Called by embedded brand widgets on ecommerce sites.
 * Requires API key authentication + domain validation.
 *
 * Body:
 *   - personImagePath: string
 *   - garmentImagePath: string
 *   - category: 'clothing' | 'jewelry' | 'glasses'
 */
router.post(
  '/request',
  widgetRateLimit,
  requireApiKey,
  validateDomain,
  [
    body('personImagePath')
      .isString()
      .notEmpty()
      .isLength({ max: 200 })
      .matches(/^[a-zA-Z0-9_-]+\/(person|garment)\/[a-zA-Z0-9_.-]+\.jpg$|^anonymous\/(person|garment)\/[a-zA-Z0-9_.-]+\.jpg$/i)
      .withMessage('personImagePath must be a valid storage path from upload'),
    body('productImagePath')
      .isString()
      .notEmpty()
      .isLength({ max: 200 })
      .matches(/^[a-zA-Z0-9_-]+\/(person|garment)\/[a-zA-Z0-9_.-]+\.jpg$/i)
      .withMessage('productImagePath must be a valid storage path from upload'),
    body('category')
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    body('productDescription').optional().isString().isLength({ max: 400 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.widgetUserId!;
      const { personImagePath, productImagePath, category, productDescription } = req.body;

      // IDOR: only storage paths under this API key owner's account (same rule as POST /api/tryon)
      const ownerPrefix = `${userId}/`;
      if (!personImagePath.startsWith(ownerPrefix) || !productImagePath.startsWith(ownerPrefix)) {
        logger.warn('Widget try-on rejected: storage paths do not belong to API key account', {
          userId,
          personPrefix: String(personImagePath).slice(0, 48),
        });
        res.status(403).json({
          error: 'Person and product images must be uploaded under this API key account',
        });
        return;
      }

      // Credit check
      const creditCheck = await checkCredits(userId);
      if (!creditCheck.allowed) {
        res.status(402).json({
          error: SHOPPER_TRYON_UNAVAILABLE_MESSAGE,
          code: 'CREDITS_EXHAUSTED',
        });
        return;
      }

      const tryonLegacyId = uuidv4();
      try {
        await cxInsertTryon({
          legacyId: tryonLegacyId,
          userId,
          personImage: personImagePath,
          productImage: productImagePath,
          category,
          status: 'queued',
        });
      } catch (dbError) {
        logger.error('Widget: Failed to create tryon record', { error: String(dbError) });
        res.status(500).json({ error: 'Failed to initiate try-on' });
        return;
      }

      const jobId = uuidv4();
      const jobData: TryOnJob = {
        jobId,
        userId,
        apiKeyId: req.apiKey!.id,
        personImageUrl: personImagePath,
        productImageUrl: productImagePath,
        category: category as ProductCategory,
        productDescription: productDescription || undefined,
        tryonDbId: tryonLegacyId,
        widgetMode: true,
      };

      const queue = getTryOnQueue();

      if (queue) {
        await enqueueTryOnJob(jobData);
        res.status(202).json({
          success: true,
          tryonId: tryonLegacyId,
          jobId,
          status: 'queued',
          pollUrl: `/api/tryon/${tryonLegacyId}`,
          estimatedWaitSeconds: 30,
        });
      } else {
        // Sync fallback
        const result = await executeTryOnPipeline(jobData);
        res.status(200).json({
          success: result.status === 'completed',
          tryonId: tryonLegacyId,
          status: result.status,
          resultUrl: result.resultUrl,
          error: result.error,
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/widget/status/:tryonId
 * Polls a widget try-on result (CORS-open for widget use).
 */
router.get(
  '/status/:tryonId',
  requireApiKey,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawId = req.params.tryonId;
      const tryonId = (Array.isArray(rawId) ? rawId[0] : rawId) ?? '';
      if (!tryonId) {
        res.status(400).json({ error: 'tryonId required' });
        return;
      }
      const widgetUid = req.widgetUserId!;
      const tryon = await cxGetTryonForUser(tryonId, widgetUid);
      if (!tryon) {
        res.status(404).json({ error: 'Try-on not found' });
        return;
      }

      let resultUrl: string | null = null;
      if (tryon.status === 'completed' && tryon.result_image) {
        resultUrl = await getSignedUrl(RESULT_BUCKET, tryon.result_image, 3600);
      }

      res.json({
        tryonId: tryon.id,
        status: tryon.status,
        resultUrl,
        category: tryon.category,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/widget/config
 * Returns widget configuration for the API key owner.
 */
router.get(
  '/config',
  requireApiKey,
  validateDomain,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await convexQueryTrusted<{
        brand_name: string | null;
        widget_activated: boolean;
        widget_show_models: boolean | undefined;
      } | null>(anyApi.backendTrusted.getWidgetProfileRow, {
        secret: env.BACKEND_SHARED_SECRET,
        userId: req.widgetUserId!,
      });

      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      if (!profile.widget_activated) {
        res.status(403).json({ error: 'Widget not activated. Subscribe to a plan.' });
        return;
      }

      const showModels = profile.widget_show_models !== false;
      let models: Awaited<ReturnType<typeof listActiveModels>> = [];
      if (showModels) {
        try {
          models = await listActiveModels();
        } catch {
          models = [];
        }
      }

      res.json({
        brandName: profile.brand_name,
        showModels,
        models,
        settings: { autoDetect: true, collectAnalytics: true },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/widget/domains
 * Adds an allowed domain for the user's first active API key.
 * Uses JWT auth (dashboard flow).
 */
router.post(
  '/domains',
  requireAuth,
  [body('domain').isString().notEmpty().withMessage('domain is required')],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { domain } = req.body as { domain?: unknown };
      if (typeof domain !== 'string') {
        res.status(400).json({ error: 'domain must be a string' });
        return;
      }
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

      try {
        await convexMutationTrusted(anyApi.backendTrusted.insertAllowedDomainForUser, {
          secret: env.BACKEND_SHARED_SECRET,
          userId,
          domain: cleanDomain,
        });
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e);
        if (msg.includes('DUPLICATE_DOMAIN')) {
          res.status(409).json({ error: 'Domain already added' });
          return;
        }
        if (msg.includes('NO_ACTIVE_API_KEY')) {
          res.status(400).json({ error: 'Create an API key first in Dashboard → API Keys' });
          return;
        }
        throw e;
      }

      res.status(201).json({ success: true, domain: cleanDomain });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
