import type { ProductCategory } from '../types';

/** Try-on categories accepted by both the dashboard API and the widget API. */
export const VALID_TRY_ON_CATEGORIES: ProductCategory[] = [
  'clothing',
  'tops',
  'bottoms',
  'dresses',
  'one-pieces',
];

/** Signed URL lifetime for try-on result images (seconds). */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Approximate queue wait time surfaced to the client so it can show a
 * progress message.  Not a guarantee — used only for UI copy.
 */
export const ESTIMATED_WAIT_SECONDS = 30;
