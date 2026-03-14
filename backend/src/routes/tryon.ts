import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { planAwareTryonRateLimit } from '../middleware/planRateLimit';
import { handleValidationErrors } from '../middleware/validate';
import { checkCredits } from '../services/credits';
import { enqueueTryOnJob, getJobStatus, getTryOnQueue } from '../services/queue/producer';
import { executeTryOnPipeline } from '../services/ai/pipeline';
import { getSupportedCategories } from '../services/ai/replicate';
import { supabaseAdmin } from '../config/supabase';
import { getSignedUrl, RESULT_BUCKET } from '../services/storage/images';
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
 *   - productDescription?: string   (optional: helps AI understand the product)
 *   - async?: boolean               (default true)
 */
router.post(
  '/',
  optionalAuth,
  planAwareTryonRateLimit,
  [
    body('personImagePath')
      .isString().notEmpty()
      .withMessage('personImagePath is required'),
    body('productImagePath')
      .isString().notEmpty()
      .withMessage('productImagePath is required'),
    body('category')
      .isIn(VALID_CATEGORIES)
      .withMessage(
        `category must be one of: ${VALID_CATEGORIES.join(', ')}`
      ),
    body('productDescription')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('productDescription must be a string under 200 characters'),
    body('async')
      .optional()
      .isBoolean(),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id || req.widgetUserId || null;
      const {
        personImagePath,
        productImagePath,
        category,
        productDescription,
        async: asyncMode = true,
      } = req.body;

      // Credit check (Enterprise bypasses)
      if (userId) {
        const creditCheck = await checkCredits(userId);
        if (!creditCheck.allowed) {
          logger.info('Credits exhausted', {
            userId,
            reason: creditCheck.reason,
            creditsRemaining: creditCheck.creditsRemaining,
          });
          res.status(402).json({
            error: creditCheck.reason || 'Insufficient credits',
            code: 'CREDITS_EXHAUSTED',
            creditsRemaining: creditCheck.creditsRemaining,
          });
          return;
        }
      }

      // Create tryon record in DB
      const { data: tryon, error: dbError } = await supabaseAdmin
        .from('tryons')
        .insert({
          user_id: userId,
          person_image: personImagePath,
          product_image: productImagePath,
          category,
          status: 'queued',
        })
        .select('id')
        .single();

      if (dbError || !tryon) {
        logger.error('Failed to create tryon record', { error: dbError?.message });
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
        tryonDbId: tryon.id,
        widgetMode: !!req.apiKey,
      };

      const queue = getTryOnQueue();

      if (asyncMode && queue) {
        await enqueueTryOnJob(jobData);

        logger.info('Try-on job queued', {
          jobId,
          tryonId: tryon.id,
          userId,
          category,
        });

        res.status(202).json({
          success: true,
          tryonId: tryon.id,
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
          tryonId: tryon.id,
          category,
        });

        const result = await executeTryOnPipeline(jobData);

        res.status(200).json({
          success: result.status === 'completed',
          tryonId: tryon.id,
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
 * Polls the status of a try-on job.
 */
router.get(
  '/:tryonId',
  optionalAuth,
  [param('tryonId').isUUID().withMessage('Invalid tryonId')],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tryonId = req.params.tryonId as string;
      const userId = req.user?.id || req.widgetUserId;

      const query = supabaseAdmin
        .from('tryons')
        .select('id, status, result_image, created_at, completed_at, category')
        .eq('id', tryonId);

      if (userId && !req.apiKey) {
        query.eq('user_id', userId);
      }

      const { data: tryon, error } = await query.single();

      if (error || !tryon) {
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
 * GET /api/tryon/job/:jobId
 * Gets Bull queue job status.
 */
router.get(
  '/job/:jobId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobId = req.params.jobId as string;
      const status = await getJobStatus(jobId);
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

      let query = supabaseAdmin
        .from('tryons')
        .select('id, status, category, result_image, created_at, completed_at', { count: 'exact' })
        .eq('user_id', req.user!.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (categoryFilter && VALID_CATEGORIES.includes(categoryFilter)) {
        query = query.eq('category', categoryFilter);
      }

      const { data: tryons, error, count } = await query;
      if (error) throw error;

      const results = await Promise.all(
        (tryons || []).map(async (t) => ({
          ...t,
          result_image: undefined,
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
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
