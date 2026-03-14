import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth';
import { requireApiKey, validateDomain } from '../middleware/apiKey';
import { widgetRateLimit } from '../middleware/rateLimiter';
import { handleValidationErrors } from '../middleware/validate';
import { checkCredits } from '../services/credits';
import { supabaseAdmin } from '../config/supabase';
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
    body('personImagePath').isString().notEmpty().withMessage('personImagePath is required'),
    body('productImagePath').isString().notEmpty().withMessage('productImagePath is required'),
    body('category')
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
    body('productDescription').optional().isString().isLength({ max: 200 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.widgetUserId!;
      const { personImagePath, productImagePath, category, productDescription } = req.body;

      // Credit check
      const creditCheck = await checkCredits(userId);
      if (!creditCheck.allowed) {
        res.status(402).json({
          error: creditCheck.reason || 'Insufficient credits',
          code: 'CREDITS_EXHAUSTED',
        });
        return;
      }

      // Create tryon record
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
        logger.error('Widget: Failed to create tryon record', { error: dbError?.message });
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
        tryonDbId: tryon.id,
        widgetMode: true,
      };

      const queue = getTryOnQueue();

      if (queue) {
        await enqueueTryOnJob(jobData);
        res.status(202).json({
          success: true,
          tryonId: tryon.id,
          jobId,
          status: 'queued',
          pollUrl: `/api/tryon/${tryon.id}`,
          estimatedWaitSeconds: 30,
        });
      } else {
        // Sync fallback
        const result = await executeTryOnPipeline(jobData);
        res.status(200).json({
          success: result.status === 'completed',
          tryonId: tryon.id,
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
      const { tryonId } = req.params;

      const { data: tryon, error } = await supabaseAdmin
        .from('tryons')
        .select('id, status, result_image, created_at, completed_at, category')
        .eq('id', tryonId)
        .eq('user_id', req.widgetUserId!)
        .single();

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
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('brand_name, widget_activated')
        .eq('id', req.widgetUserId!)
        .single();

      if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }

      if (!profile.widget_activated) {
        res.status(403).json({ error: 'Widget not activated. Subscribe to a plan.' });
        return;
      }

      res.json({
        brandName: profile.brand_name,
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
      const { domain } = req.body;
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

      const { data: apiKey } = await supabaseAdmin
        .from('api_keys')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .single();

      if (!apiKey) {
        res.status(400).json({ error: 'Create an API key first in Dashboard → API Keys' });
        return;
      }

      const { error } = await supabaseAdmin.from('allowed_domains').insert({
        api_key_id: apiKey.id,
        domain: cleanDomain,
      });

      if (error) {
        if (error.code === '23505') {
          res.status(409).json({ error: 'Domain already added' });
        } else {
          throw error;
        }
        return;
      }

      res.status(201).json({ success: true, domain: cleanDomain });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
