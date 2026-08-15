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
}

export interface OutfitSlotValidation {
  valid: boolean;
  error?: string;
}

/**
 * Rules:
 *  - Exactly one of {top+bottom} or {one_piece} — never both, never a bare top or bare bottom.
 *  - shoes and outerwear are each optional, additive, at most one.
 *  - At least one slot must be filled.
 */
export function validateOutfitSlots(slots: OutfitSlots): OutfitSlotValidation {
  const hasTop = Boolean(slots.top);
  const hasBottom = Boolean(slots.bottom);
  const hasOnePiece = Boolean(slots.one_piece);

  if (!hasTop && !hasBottom && !hasOnePiece && !slots.shoes && !slots.outerwear) {
    return { valid: false, error: 'Pick at least one product to build an outfit.' };
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

  if (!hasTop && !hasBottom && !hasOnePiece) {
    return { valid: false, error: 'Pick a top + bottom, or a one-piece, to build an outfit.' };
  }

  return { valid: true };
}

/** Ordered slot keys used for consistent flat-lay layout and prompt generation. */
export const OUTFIT_SLOT_ORDER: Array<keyof OutfitSlots> = ['outerwear', 'top', 'one_piece', 'bottom', 'shoes'];
