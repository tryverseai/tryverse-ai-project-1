import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { getSignedUrl, INPUT_BUCKET } from '../services/storage/images';
import { logger } from '../config/logger';
import { createConvexClient, anyApi } from '../config/convexHttp';

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
    return await getSignedUrl(INPUT_BUCKET, pathOrUrl, 3600);
  } catch {
    return pathOrUrl;
  }
}

const VALID_CATEGORIES = ['clothing', 'bags', 'glasses'];

router.get(
  '/',
  requireAuth,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('category').optional().isIn(VALID_CATEGORIES),
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
    body('image_url').optional().isString().isLength({ max: 2048 }),
    body('category').isIn(VALID_CATEGORIES),
    body('product_url').optional().isURL().isLength({ max: 2048 }),
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
    body('image_url').optional().isString().isLength({ max: 2048 }),
    body('category').optional().isIn(VALID_CATEGORIES),
    body('product_url').optional().isURL().isLength({ max: 2048 }),
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
      const msg = String(err);
      if (msg.includes('Not found')) {
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
      const msg = String(err);
      if (msg.includes('Not found')) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      next(err);
    }
  }
);

export default router;
