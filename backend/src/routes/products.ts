import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query } from 'express-validator';
import { requireAuth } from '../middleware/auth';
import { handleValidationErrors } from '../middleware/validate';
import { supabaseAdmin } from '../config/supabase';
import { getSignedUrl, INPUT_BUCKET } from '../services/storage/images';
import { logger } from '../config/logger';

const router = Router();

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

/**
 * GET /api/products
 * List products for the authenticated user.
 */
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

      let queryBuilder = supabaseAdmin
        .from('products')
        .select('id, name, image_url, category, product_url, tryons_count, created_at', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (category && VALID_CATEGORIES.includes(category)) {
        queryBuilder = queryBuilder.eq('category', category);
      }

      const from = (page - 1) * limit;
      const { data: rows, error, count } = await queryBuilder.range(from, from + limit - 1);

      if (error) {
        logger.error('Products list error', { userId, error: error.message });
        res.status(500).json({ error: 'Failed to fetch products' });
        return;
      }

      const products = await Promise.all(
        (rows || []).map(async (p) => ({
          ...p,
          image_display_url: await resolveImageUrl(p.image_url),
        }))
      );

      res.json({
        products,
        pagination: {
          page,
          limit,
          total: count ?? 0,
          pages: Math.ceil((count ?? 0) / limit) || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/products
 * Create a new product.
 */
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
      const userId = req.user!.id;
      const { name, image_url, category, product_url } = req.body;

      const { data: product, error } = await supabaseAdmin
        .from('products')
        .insert({
          user_id: userId,
          name,
          image_url: image_url || null,
          category,
          product_url: product_url || null,
        })
        .select('id, name, image_url, category, product_url, tryons_count, created_at')
        .single();

      if (error) {
        logger.error('Product create error', { userId, error: error.message });
        res.status(500).json({ error: 'Failed to create product' });
        return;
      }

      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/products/:id
 * Get a single product.
 */
router.get(
  '/:id',
  requireAuth,
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const { data: product, error } = await supabaseAdmin
        .from('products')
        .select('id, name, image_url, category, product_url, tryons_count, created_at, updated_at')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (error || !product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      res.json(product);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/products/:id
 * Update a product.
 */
router.put(
  '/:id',
  requireAuth,
  [
    param('id').isUUID(),
    body('name').optional().isString().trim().notEmpty().isLength({ max: 200 }),
    body('image_url').optional().isString().isLength({ max: 2048 }),
    body('category').optional().isIn(VALID_CATEGORIES),
    body('product_url').optional().isURL().isLength({ max: 2048 }),
  ],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.image_url !== undefined) updates.image_url = req.body.image_url;
      if (req.body.category !== undefined) updates.category = req.body.category;
      if (req.body.product_url !== undefined) updates.product_url = req.body.product_url;

      const { data: product, error } = await supabaseAdmin
        .from('products')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select('id, name, image_url, category, product_url, tryons_count, created_at, updated_at')
        .single();

      if (error || !product) {
        res.status(error?.code === 'PGRST116' ? 404 : 500).json({ error: 'Product not found' });
        return;
      }

      res.json(product);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/products/:id
 * Delete a product.
 */
router.delete(
  '/:id',
  requireAuth,
  [param('id').isUUID()],
  handleValidationErrors,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const { error } = await supabaseAdmin
        .from('products')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        res.status(500).json({ error: 'Failed to delete product' });
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
