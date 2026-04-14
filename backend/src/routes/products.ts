import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { getSignedUrl, INPUT_BUCKET } from '../services/storage/images';
import { logger } from '../config/logger';
import { createConvexClient, anyApi } from '../config/convexHttp';
import { VALID_TRY_ON_CATEGORIES, SIGNED_URL_TTL_SECONDS } from '../lib/constants';

/**
 * Returns true when a Convex mutation throws a "record not found" error.
 * Convex surfaces this as a plain Error whose message contains "Not found".
 * Centralised here so the string check is easy to update if Convex changes it.
 */
function isConvexNotFound(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('Not found');
}

/**
 * Validates that an image_url is either:
 *  - A valid HTTPS URL (external CDN image), or
 *  - A storage path (alphanumeric + safe path characters, no protocol)
 * Rejects javascript:, data:, http://, file:, etc.
 */
function isImageUrlSafe(value: string): boolean {
  if (!value) return true;
  if (value.startsWith('https://')) {
    try { new URL(value); return true; } catch { return false; }
  }
  // Storage path: no protocol, only safe path characters
  return !value.includes(':') && /^[a-zA-Z0-9/_.\-]+$/.test(value);
}

const router = Router();

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7);
}

function convexForRequest(req: Request) {
  const c = createConvexClient();
  const t = bearer(req);
  if (t) c.setAuth(t);
  return c;
}

async function resolveImageUrl(pathOrUrl: string | null): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  try {
    return await getSignedUrl(INPUT_BUCKET, pathOrUrl, SIGNED_URL_TTL_SECONDS);
  } catch {
    return pathOrUrl;
  }
}

router.get(
  '/',
  requireAuth,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('category').optional().isIn(VALID_TRY_ON_CATEGORIES),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Number(req.query.limit) || 20);
      const category = req.query.category as string | undefined;

      const client = convexForRequest(req);
      const result = await client.query(anyApi.products.listMyProducts, {
        page,
        limit,
        category,
      });

      if (!result) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const products = await Promise.all(
        (result.products || []).map(async (p: Record<string, unknown>) => ({
          ...p,
          image_display_url: await resolveImageUrl((p.image_url as string) || null),
        }))
      );

      res.json({
        products,
        pagination: result.pagination,
      });
    } catch (err) {
      logger.error('Products list error', { userId: req.user?.id, error: String(err) });
      next(err);
    }
  }
);

router.post(
  '/',
  requireAuth,
  [
    body('name').isString().trim().notEmpty().isLength({ max: 200 }),
    body('image_url').optional().isString().isLength({ max: 2048 })
      .custom((v: string) => { if (v && !isImageUrlSafe(v)) throw new Error('image_url must be a valid HTTPS URL or storage path'); return true; }),
    body('category').isIn(VALID_TRY_ON_CATEGORIES),
    body('product_url').optional().isURL({ protocols: ['https'], require_protocol: true }).isLength({ max: 2048 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, image_url, category, product_url } = req.body;
      const client = convexForRequest(req);
      const product = await client.mutation(anyApi.products.createProduct, {
        name,
        image_url,
        category,
        product_url,
      });
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id',
  requireAuth,
  [param('id').isString().trim().notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const client = convexForRequest(req);
      const product = await client.query(anyApi.products.getMyProduct, { id });
      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      res.json(product);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/:id',
  requireAuth,
  [
    param('id').isString().trim().notEmpty(),
    body('name').optional().isString().trim().notEmpty().isLength({ max: 200 }),
    body('image_url').optional().isString().isLength({ max: 2048 })
      .custom((v: string) => { if (v && !isImageUrlSafe(v)) throw new Error('image_url must be a valid HTTPS URL or storage path'); return true; }),
    body('category').optional().isIn(VALID_TRY_ON_CATEGORIES),
    body('product_url').optional().isURL({ protocols: ['https'], require_protocol: true }).isLength({ max: 2048 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const client = convexForRequest(req);
      const product = await client.mutation(anyApi.products.updateProduct, {
        id,
        name: req.body.name,
        image_url: req.body.image_url,
        category: req.body.category,
        product_url: req.body.product_url,
      });
      res.json(product);
    } catch (err) {
      if (isConvexNotFound(err)) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      next(err);
    }
  }
);

router.delete(
  '/:id',
  requireAuth,
  [param('id').isString().trim().notEmpty()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const client = convexForRequest(req);
      await client.mutation(anyApi.products.deleteProduct, { id });
      res.status(204).send();
    } catch (err) {
      if (isConvexNotFound(err)) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      next(err);
    }
  }
);

export default router;
