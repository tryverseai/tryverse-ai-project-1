/**
 * Outfit Builder slot rules. A "slot" is a garment position — a shopper/brand picks at most one
 * product per slot. Server-side validation is authoritative; the frontend mirrors these same
 * rules for instant UX feedback, but a client can never bypass this check since it re-runs here.
 */

export interface OutfitSlots {
  top?: string;
  bottom?: string;
  one_piece?: string;
  shoes?: string;
  outerwear?: string;
  /** Sunglasses/glasses — matches the `'eyewear'` product category. */
  eyewear?: string;
  /** Earrings, necklaces, or other jewelry — matches the `'jewelry'` product category (not
   *  split further since the catalog itself doesn't distinguish sub-types yet). */
  jewelry?: string;
}

export interface OutfitSlotValidation {
  valid: boolean;
  error?: string;
}

/**
 * Rules:
 *  - Exactly one of {top+bottom} or {one_piece} — never both, never a bare top or bare bottom.
 *  - shoes, outerwear, eyewear, and jewelry are each optional, additive, at most one.
 *  - At least one slot must be filled overall — but unlike shoes/outerwear (which only ever made
 *    sense as an addition to a clothing anchor), eyewear/jewelry are valid completely on their
 *    own with no top/bottom/one_piece at all (e.g. "just add these sunglasses and this necklace
 *    to the model"), so no clothing anchor is required anymore.
 */
export function validateOutfitSlots(slots: OutfitSlots): OutfitSlotValidation {
  const hasTop = Boolean(slots.top);
  const hasBottom = Boolean(slots.bottom);
  const hasOnePiece = Boolean(slots.one_piece);
  const anySlotFilled = Object.values(slots).some(Boolean);

  if (!anySlotFilled) {
    return { valid: false, error: 'Pick at least one product to build a look.' };
  }

  if (hasOnePiece && (hasTop || hasBottom)) {
    return { valid: false, error: 'A one-piece (dress/jumpsuit) cannot be combined with a separate top or bottom.' };
  }

  if (hasTop && !hasBottom) {
    return { valid: false, error: 'A top needs a bottom to complete the outfit — or pick a one-piece instead.' };
  }

  if (hasBottom && !hasTop) {
    return { valid: false, error: 'A bottom needs a top to complete the outfit — or pick a one-piece instead.' };
  }

  return { valid: true };
}

/** Ordered slot keys used for consistent flat-lay layout and prompt generation. */
export const OUTFIT_SLOT_ORDER: Array<keyof OutfitSlots> = [
  'outerwear',
  'top',
  'one_piece',
  'bottom',
  'shoes',
  'eyewear',
  'jewelry',
];
