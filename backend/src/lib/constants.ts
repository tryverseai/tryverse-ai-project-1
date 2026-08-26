import type { ProductCategory, CatalogCategory } from '../types';

/** Try-on categories accepted by both the dashboard API and the widget API. */
export const VALID_TRY_ON_CATEGORIES: ProductCategory[] = [
  'clothing',
  'tops',
  'bottoms',
  'dresses',
  'one-pieces',
  'eyewear',
  'earrings',
  'necklace',
  'jewelry',
  'footwear',
];

/**
 * Product catalog categories — used by `routes/products.ts`'s catalog CRUD validators. Equal to
 * `VALID_TRY_ON_CATEGORIES`: catalog and single-item try-on share one category space (see
 * `CatalogCategory` in `types/index.ts`). Kept as a separate export so catalog and try-on
 * validators can diverge again later without a call-site rewrite.
 */
export const VALID_PRODUCT_CATEGORIES: CatalogCategory[] = VALID_TRY_ON_CATEGORIES;

/**
 * Display grouping for product categories — Product → Category group → Type. Purely UI/labeling
 * metadata (not a schema or validation change): both the Products catalog page and Personal
 * Studio's picker group `VALID_TRY_ON_CATEGORIES` values under one of these three headings rather
 * than showing a flat list. Add a new `ProductCategory` value to the appropriate group's
 * `categories` array when the platform gains one — no other change needed for it to appear
 * grouped correctly.
 */
export const PRODUCT_CATEGORY_GROUPS: { group: string; categories: ProductCategory[] }[] = [
  { group: 'Clothing', categories: ['clothing', 'tops', 'bottoms', 'dresses', 'one-pieces'] },
  { group: 'Footwear', categories: ['footwear'] },
  { group: 'Accessories', categories: ['eyewear', 'earrings', 'necklace', 'jewelry'] },
];

/** Friendly display labels for `ProductCategory` values — raw enum strings are not shown to users. */
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  clothing: 'Clothing',
  tops: 'Tops',
  bottoms: 'Bottoms',
  dresses: 'Dresses',
  'one-pieces': 'One-pieces',
  footwear: 'Footwear',
  eyewear: 'Eyewear',
  earrings: 'Earrings',
  necklace: 'Necklace',
  jewelry: 'Other Jewelry',
};

/** Signed URL lifetime for try-on result images (seconds). */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Approximate queue wait time surfaced to the client so it can show a
 * progress message.  Not a guarantee — used only for UI copy.
 */
export const ESTIMATED_WAIT_SECONDS = 30;
