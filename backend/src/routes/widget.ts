import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { requireApiKey, validateDomain, requireScope } from '../middleware/apiKey';
import { listActiveModels } from '../services/models/modelLibrary';
import { widgetRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { checkCredits, SHOPPER_TRYON_UNAVAILABLE_MESSAGE } from '../services/credits';
import { env } from '../config/env';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../config/convexHttp';
import { cxGetTryonForUser } from '../services/tryonConvexBridge';
import { createAndDispatchTryOn, TryOnDbError } from '../services/tryOnOrchestrator';
import { getSignedUrl, RESULT_BUCKET } from '../services/storage/images';
import { logger } from '../config/logger';
import { UPLOAD_RELATIVE_IMAGE_PATH_RE } from '../lib/storagePathRegex';
import { VALID_TRY_ON_CATEGORIES, SIGNED_URL_TTL_SECONDS } from '../lib/constants';
import type { ProductCategory } from '../types';

const router = Router();

/**
 * POST /api/widget/request
 * The main widget try-on endpoint.
 * Called by embedded brand widgets on ecommerce sites.
 * Requires API key authentication + domain validation.
 *
 * Body:
 *   - personImagePath: string       (path returned by POST /api/upload)
 *   - productImagePath: string      (path returned by POST /api/upload)
 *   - category: ProductCategory     (clothing | tops | bottoms | dresses | one-pieces — see VALID_TRY_ON_CATEGORIES)
 *   - productDescription?: string
 */
router.post(
  '/request',
  widgetRateLimit,
  requireApiKey,
  requireScope('write'),
  validateDomain,
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
      .withMessage(`category must be one of: ${VALID_TRY_ON_CATEGORIES.join(', ')}`),
    body('productDescription').optional({ nullable: true }).isString().isLength({ max: 400 }),
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
        logger.info('Widget: credits exhausted', {
          userId,
          reason: creditCheck.reason,
          creditsRemaining: creditCheck.creditsRemaining,
        });
        res.status(402).json({
          error: SHOPPER_TRYON_UNAVAILABLE_MESSAGE,
          code: 'CREDITS_EXHAUSTED',
        });
        return;
      }

      let dispatch;
      try {
        dispatch = await createAndDispatchTryOn({
          userId,
          apiKeyId: req.apiKey!.id,
          personImagePath,
          productImagePath,
          category: category as ProductCategory,
          productDescription: productDescription || undefined,
          asyncMode: true,
          widgetMode: true,
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
          pollUrl: `/api/tryon/${dispatch.tryonLegacyId}`,
          estimatedWaitSeconds: dispatch.estimatedWaitSeconds,
        });
      } else {
        // Sync fallback (queue unavailable)
        const { result } = dispatch;
        res.status(200).json({
          success: result.status === 'completed',
          tryonId: dispatch.tryonLegacyId,
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
        resultUrl = await getSignedUrl(RESULT_BUCKET, tryon.result_image, SIGNED_URL_TTL_SECONDS);
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
 * GET /api/widget/domains
 * Lists allowed domains for the authenticated user's active API keys.
 */
router.get(
  '/domains',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const domains = await convexQueryTrusted<
        Array<{ domain: string; apiKeyId: string; apiKeyName: string }>
      >(anyApi.backendTrusted.listAllowedDomainsForUser, {
        secret: env.BACKEND_SHARED_SECRET,
        userId,
      });
      res.json({ domains: domains ?? [] });
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
