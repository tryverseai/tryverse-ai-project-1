import type { ProductCategory } from '../../../types';
import { inferIsLongGarment } from '../garmentDescriptor';
import { isClothingCategory } from '../replicate';

/** Topology used to route clothing try-on (VTON vs diffusion-friendly full-body). */
export type GarmentTopology = 'upper' | 'lower' | 'full_body' | 'unspecified';

/**
 * Classify garment layout from copy + product aspect ratio.
 * Used for routing; does not replace the API `category` (clothing | tops | bottoms | dresses | one-pieces).
 */
export function classifyGarmentTopology(
  category: ProductCategory,
  productDescription?: string | null,
  productHeightOverWidth?: number
): GarmentTopology {
  if (!isClothingCategory(category)) return 'unspecified';

  // An explicit category already tells us the topology directly — no need to infer.
  if (category === 'dresses' || category === 'one-pieces') return 'full_body';
  if (category === 'tops') return 'upper';
  if (category === 'bottoms') return 'lower';

  if (inferIsLongGarment(productHeightOverWidth, productDescription)) {
    return 'full_body';
  }

  const d = (productDescription ?? '').toLowerCase();
  if (
    /\b(pant|jeans?|trouser|joggers?|legging|skirt|shorts?|chino|cargo\s*pant)\b/i.test(d)
  ) {
    return 'lower';
  }
  if (
    /\b(shirt|top|blouse|jacket|blazer|sweater|hoodie|coat|tee|t-shirt|cardigan|vest)\b/i.test(d)
  ) {
    return 'upper';
  }

  if (productHeightOverWidth !== undefined && Number.isFinite(productHeightOverWidth)) {
    if (productHeightOverWidth < 0.92) return 'lower';
  }

  return 'unspecified';
}
