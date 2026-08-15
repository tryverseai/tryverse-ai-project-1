import type { ProductCategory, CatalogCategory } from '../types';

/** Try-on categories accepted by both the dashboard API and the widget API. */
export const VALID_TRY_ON_CATEGORIES: ProductCategory[] = [
  'clothing',
  'tops',
  'bottoms',
  'dresses',
  'one-pieces',
];

/**
 * Product catalog categories — a superset of `VALID_TRY_ON_CATEGORIES` that also allows `'shoes'`
 * (Outfit Builder). Used only by `routes/products.ts`'s catalog CRUD validators — `routes/tryon.ts`
 * and `routes/widget.ts` deliberately keep using `VALID_TRY_ON_CATEGORIES` unchanged, since those
 * are the actual single-garment try-on request validators.
 */
export const VALID_PRODUCT_CATEGORIES: CatalogCategory[] = [...VALID_TRY_ON_CATEGORIES, 'shoes'];

/** Signed URL lifetime for try-on result images (seconds). */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Approximate queue wait time surfaced to the client so it can show a
 * progress message.  Not a guarantee — used only for UI copy.
 */
export const ESTIMATED_WAIT_SECONDS = 30;
