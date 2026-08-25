import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { requireAuth, optionalAuth, requireAuthenticatedActor, convexProfileCreditLookupKey } from '../middleware/auth';
import { optionalApiKey, requireScope } from '../middleware/apiKey';
import { tryonRateLimit } from '../middleware/rateLimiter';
import { planAwareTryonRateLimit } from '../middleware/planRateLimit';
import { handleValidationErrors } from '../middleware/validate';
import { checkCredits, SHOPPER_TRYON_UNAVAILABLE_MESSAGE } from '../services/credits';
import { getJobStatusForUser } from '../services/queue/producer';
import { getSupportedCategories } from '../services/ai/replicate';
import { getSignedUrl, RESULT_BUCKET } from '../services/storage/images';
import {
  cxGetTryonForUser,
  cxDeleteTryonForUser,
  cxListTryons,
  cxListTryonsCursor,
} from '../services/tryonConvexBridge';
import {
  createAndDispatchTryOn,
  TryOnDbError,
} from '../services/tryOnOrchestrator';
import { logger } from '../config/logger';
import { UPLOAD_RELATIVE_IMAGE_PATH_RE } from '../lib/storagePathRegex';
import { VALID_TRY_ON_CATEGORIES, SIGNED_URL_TTL_SECONDS } from '../lib/constants';
import type { ProductCategory } from '../types';

const router = Router();

/**
 * GET /api/tryon/categories
 * Returns all supported product categories with display metadata.
 */
router.get('/categories', (_req: Request, res: Response) => {
  res.json({ categories: getSupportedCategories() });
});

/**
 * POST /api/tryon
 * Initiates a virtual try-on job for an apparel or accessory product category.
 *
 * Body:
 *   - personImagePath: string       (path returned by POST /api/upload)
 *   - productImagePath: string      (path returned by POST /api/upload)
 *   - category: ProductCategory     (clothing|tops|bottoms|dresses|one-pieces|eyewear|jewelry|footwear — see VALID_TRY_ON_CATEGORIES)
 *   - productDescription?: string   (optional: extra detail; server always adds product-first instructions for every try-on)
 *   - async?: boolean               (default true)
 */
router.post(
  '/',
  optionalApiKey,
  requireScope('write'),
  optionalAuth,
  requireAuthenticatedActor,
  // Must run after the auth middleware above — its keyGenerator reads req.user/req.apiKey, which
  // don't exist yet if this runs first (a real bug found in security review: every "per-user"
  // limiter registered before auth silently degrades to a pure per-IP limiter, since its key
  // always falls through to req.ip).
  tryonRateLimit,
  planAwareTryonRateLimit,
  [
    body('personImagePath')
      .isString()
      .notEmpty()
      .isLength({ max: 200 })
      .matches(UPLOAD_RELATIVE_IMAGE_PATH_RE)
      .withMessage('personImagePath must be a valid storage path from upload'),
    body('productImagePath')
      .isString()
      .notEmpty()
      .isLength({ max: 200 })
      .matches(UPLOAD_RELATIVE_IMAGE_PATH_RE)
      .withMessage('productImagePath must be a valid storage path from upload'),
    body('category')
      .isIn(VALID_TRY_ON_CATEGORIES)
      .withMessage(
        `category must be one of: ${VALID_TRY_ON_CATEGORIES.join(', ')}`
      ),
    body('productDescription')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 400 })
      .withMessage('productDescription must be a string under 400 characters'),
    body('async')
      .optional({ nullable: true })
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

      const creditCheck = await checkCredits(convexProfileCreditLookupKey(req));
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

      let dispatch;
      try {
        dispatch = await createAndDispatchTryOn({
          userId,
          apiKeyId: req.apiKey?.id || null,
          personImagePath,
          productImagePath,
          category: category as ProductCategory,
          productDescription: productDescription || undefined,
          asyncMode,
          widgetMode: !!req.apiKey,
        });
      } catch (err) {
        if (err instanceof TryOnDbError) {
          res.status(500).json({ error: 'Failed to initiate try-on' });
          return;
        }
        throw err;
      }

      if (dispatch.dispatched === 'queued') {
        res.status(202).json({
          success: true,
          tryonId: dispatch.tryonLegacyId,
          jobId: dispatch.jobId,
          status: 'queued',
          category,
          message: 'Try-on job queued. Poll /api/tryon/:tryonId for status.',
          estimatedWaitSeconds: dispatch.estimatedWaitSeconds,
        });
      } else {
        const { result } = dispatch;
        res.status(200).json({
          success: result.status === 'completed',
          tryonId: dispatch.tryonLegacyId,
          jobId: dispatch.jobId,
          status: result.status,
          category,
          resultUrl: result.resultUrl,
          processingTimeMs: result.processingTimeMs,
          // Sanitized public message + stable code — no vendor internals
          error: result.error,
          errorCode: result.errorCode,
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
        resultUrl = await getSignedUrl(RESULT_BUCKET, tryon.result_image, SIGNED_URL_TTL_SECONDS);
      }

      // NOTE: This single-record response uses camelCase timestamps (createdAt, completedAt)
      // while the list endpoint (GET /) uses snake_case (created_at, completed_at) to match
      // the raw Convex row shape.  This is a known divergence preserved for backward compat.
      res.json({
        tryonId: tryon.id,
        status: tryon.status,
        category: tryon.category,
        resultUrl,
        // H-3: Surface failure reason so the frontend can show a meaningful error message.
        // error_message comes from cxPatchTryon when the pipeline finishes; falls back if absent.
        error: tryon.status === 'failed' ? (tryon.error_message ?? 'Processing failed') : undefined,
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
 * Lists a user's try-on history.
 *
 * Cursor mode (preferred — O(numItems) read):
 *   ?limit=20&cursor=<opaque>   — returns { tryons, nextCursor, isDone }
 *
 * Page mode (backward-compat — O(n_user) read):
 *   ?page=1&limit=20            — returns { tryons, pagination }
 *
 * Pass `cursor=null` or omit `cursor` to start from the most recent try-on.
 */
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '20'), 10), 100);
      const cursorParam = req.query.cursor; // present (even if empty string) = cursor mode

      if (cursorParam !== undefined) {
        // ── Cursor mode: bounded O(numItems) read ────────────────────────────
        const cursor = typeof cursorParam === 'string' && cursorParam.length > 0
          ? cursorParam
          : null;

        const { tryons, nextCursor, isDone } = await cxListTryonsCursor(
          req.user!.id,
          limit,
          cursor
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
                ? await getSignedUrl(RESULT_BUCKET, t.result_image, SIGNED_URL_TTL_SECONDS).catch(() => null)
                : null,
          }))
        );

        res.json({ tryons: results, nextCursor, isDone });
        return;
      }

      // ── Page mode: backward-compat (now uses the composite index) ─────────
      const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
      const offset = (page - 1) * limit;
      const categoryFilter = req.query.category as ProductCategory | undefined;

      const { tryons, total } = await cxListTryons(
        req.user!.id,
        limit,
        offset,
        categoryFilter && VALID_TRY_ON_CATEGORIES.includes(categoryFilter) ? categoryFilter : undefined
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
              ? await getSignedUrl(RESULT_BUCKET, t.result_image, SIGNED_URL_TTL_SECONDS).catch(() => null)
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
