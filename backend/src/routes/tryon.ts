import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, optionalAuth, requireAuthenticatedActor } from '../middleware/auth';
import { optionalApiKey } from '../middleware/apiKey';
import { tryonRateLimit } from '../middleware/rateLimiter';
import { planAwareTryonRateLimit } from '../middleware/planRateLimit';
import { handleValidationErrors } from '../middleware/validate';
import { checkCredits, SHOPPER_TRYON_UNAVAILABLE_MESSAGE } from '../services/credits';
import { enqueueTryOnJob, getJobStatusForUser, getTryOnQueue } from '../services/queue/producer';
import { executeTryOnPipeline } from '../services/ai/pipeline';
import { getSupportedCategories } from '../services/ai/replicate';
import { getSignedUrl, RESULT_BUCKET } from '../services/storage/images';
import {
  cxInsertTryon,
  cxGetTryonForUser,
  cxDeleteTryonForUser,
  cxListTryons,
} from '../services/tryonConvexBridge';
import { logger } from '../config/logger';
import type { TryOnJob, ProductCategory } from '../types';

const router = Router();

const VALID_CATEGORIES: ProductCategory[] = ['clothing', 'bags', 'glasses'];

/**
 * GET /api/tryon/categories
 * Returns all supported product categories with display metadata.
 */
router.get('/categories', (_req: Request, res: Response) => {
  res.json({ categories: getSupportedCategories() });
});

/**
 * POST /api/tryon
 * Initiates a virtual try-on job for ANY product category.
 *
 * Body:
 *   - personImagePath: string       (path returned by POST /api/upload)
 *   - productImagePath: string      (path returned by POST /api/upload)
 *   - category: ProductCategory     (clothing|shoes|glasses|jewelry|earrings|bracelets|rings|hats|bags|accessories)
 *   - productDescription?: string   (optional: extra detail; server always adds product-first instructions for every try-on)
 *   - async?: boolean               (default true)
 */
router.post(
  '/',
  tryonRateLimit,
  optionalApiKey,
  optionalAuth,
  requireAuthenticatedActor,
  planAwareTryonRateLimit,
  [
    body('personImagePath')
      .isString()
      .notEmpty()
      .isLength({ max: 200 })
      .matches(
        /^[a-zA-Z0-9_-]+\/(person|garment)\/[a-zA-Z0-9_.-]+\.jpg$|^anonymous\/(person|garment)\/[a-zA-Z0-9_.-]+\.jpg$/i
      )
      .withMessage('personImagePath must be a valid storage path from upload'),
    body('productImagePath')
      .isString()
      .notEmpty()
      .isLength({ max: 200 })
      .matches(
        /^[a-zA-Z0-9_-]+\/(person|garment)\/[a-zA-Z0-9_.-]+\.jpg$|^anonymous\/(person|garment)\/[a-zA-Z0-9_.-]+\.jpg$/i
      )
      .withMessage('productImagePath must be a valid storage path from upload'),
    body('category')
      .isIn(VALID_CATEGORIES)
      .withMessage(
        `category must be one of: ${VALID_CATEGORIES.join(', ')}`
      ),
    body('productDescription')
      .optional()
      .isString()
      .isLength({ max: 400 })
      .withMessage('productDescription must be a string under 400 characters'),
    body('async')
      .optional()
      .isBoolean(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user?.id || req.widgetUserId) as string;
      const {
        personImagePath,
        productImagePath,
        category,
        productDescription,
        async: asyncMode = true,
      } = req.body;

      const ownerPrefix = `${userId}/`;
      if (!personImagePath.startsWith(ownerPrefix) || !productImagePath.startsWith(ownerPrefix)) {
        logger.warn('Try-on rejected: storage paths do not belong to authenticated account', {
          userId,
          personImagePath: String(personImagePath).slice(0, 80),
        });
        res.status(403).json({ error: 'Person and product images must be uploaded under your account' });
        return;
      }

      const creditCheck = await checkCredits(userId);
      if (!creditCheck.allowed) {
        logger.info('Credits exhausted', {
          userId,
          reason: creditCheck.reason,
          creditsRemaining: creditCheck.creditsRemaining,
        });
        res.status(402).json({
          error: SHOPPER_TRYON_UNAVAILABLE_MESSAGE,
          code: 'CREDITS_EXHAUSTED',
          creditsRemaining: creditCheck.creditsRemaining,
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
        logger.error('Failed to create tryon record', { error: String(dbError) });
        res.status(500).json({ error: 'Failed to initiate try-on' });
        return;
      }

      const jobId = uuidv4();
      const jobData: TryOnJob = {
        jobId,
        userId,
        apiKeyId: req.apiKey?.id || null,
        personImageUrl: personImagePath,
        productImageUrl: productImagePath,
        category: category as ProductCategory,
        productDescription: productDescription || undefined,
        tryonDbId: tryonLegacyId,
        widgetMode: !!req.apiKey,
      };

      const queue = getTryOnQueue();

      if (asyncMode && queue) {
        await enqueueTryOnJob(jobData);

        logger.info('Try-on job queued', {
          jobId,
          tryonId: tryonLegacyId,
          userId,
          category,
        });

        res.status(202).json({
          success: true,
          tryonId: tryonLegacyId,
          jobId,
          status: 'queued',
          category,
          message: 'Try-on job queued. Poll /api/tryon/:tryonId for status.',
          estimatedWaitSeconds: 30,
        });
      } else {
        // Sync processing (no queue or explicitly requested)
        logger.info('Processing try-on synchronously', {
          jobId,
          tryonId: tryonLegacyId,
          category,
        });

        const result = await executeTryOnPipeline(jobData);

        res.status(200).json({
          success: result.status === 'completed',
          tryonId: tryonLegacyId,
          jobId,
          status: result.status,
          category,
          resultUrl: result.resultUrl,
          processingTimeMs: result.processingTimeMs,
          error: result.error,
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/tryon/:tryonId
 * Polls the status of a try-on job. Supports JWT (dashboard) or API key (widget).
 */
router.get(
  '/:tryonId',
  optionalApiKey,
  optionalAuth,
  [param('tryonId').isUUID().withMessage('Invalid tryonId')],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tryonId = req.params.tryonId as string;
      const userId = req.user?.id || req.widgetUserId;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required to access try-on status' });
        return;
      }

      const tryon = await cxGetTryonForUser(tryonId, userId);
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
        category: tryon.category,
        resultUrl,
        createdAt: tryon.created_at,
        completedAt: tryon.completed_at,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/tryon/:tryonId
 * Removes a try-on record owned by the authenticated user (B2C gallery / cleanup).
 */
router.delete(
  '/:tryonId',
  requireAuth,
  [param('tryonId').isUUID().withMessage('Invalid tryonId')],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tryonId = req.params.tryonId as string;
      const deleted = await cxDeleteTryonForUser(tryonId, req.user!.id);
      if (!deleted) {
        res.status(404).json({ error: 'Try-on not found' });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/tryon/job/:jobId
 * Gets Bull queue job status. Verifies ownership before returning.
 */
router.get(
  '/job/:jobId',
  requireAuth,
  [param('jobId').isString().notEmpty().withMessage('jobId required')],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobId = req.params.jobId as string;
      const status = await getJobStatusForUser(jobId, req.user!.id);
      if (!status) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      res.json(status);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/tryon
 * Lists a user's try-on history, optionally filtered by category.
 */
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 100);
      const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
      const offset = (page - 1) * limit;
      const categoryFilter = req.query.category as ProductCategory | undefined;

      const { tryons, total } = await cxListTryons(
        req.user!.id,
        limit,
        offset,
        categoryFilter && VALID_CATEGORIES.includes(categoryFilter) ? categoryFilter : undefined
      );

      const results = await Promise.all(
        tryons.map(async (t) => ({
          id: t.id,
          status: t.status,
          category: t.category,
          created_at: t.created_at,
          completed_at: t.completed_at,
          resultUrl:
            t.status === 'completed' && t.result_image
              ? await getSignedUrl(RESULT_BUCKET, t.result_image, 3600).catch(() => null)
              : null,
        }))
      );

      res.json({
        tryons: results,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
