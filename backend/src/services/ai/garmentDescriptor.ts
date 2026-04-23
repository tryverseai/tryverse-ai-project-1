/**
 * Product-first text for Replicate try-on models.
 *
 * Used for every try-on job in this backend (dashboard, Studio, widget, admin retry,
 * async worker)—there is no special case per SKU. Any upload gets the same
 * “follow the product image” bias; optional `productDescription` from the client
 * adds detail on top.
 */

const MAX_LEN = 380;
const MAX_FASHN_LEN = 320;

const FIDELITY_CLOTHING =
  'Wear exactly the garment from the product image: same neckline, straps or sleeves, length, silhouette, color and fabric. ' +
  'Remove the original outfit completely; do not keep its cut or style.';

/** When the product crop is tall (typical dress/gown hero), steer away from bodysuit-length output. */
const GOWN_LENGTH_HINT =
  ' Product image is full-length (dress or gown). Render one continuous garment from shoulders to feet exactly like the product photo—' +
  'floor- or ankle-length, no cut-off at waist or mid-thigh; never a crop top, bodysuit, or two-piece band. ' +
  'Keep the hem as long as in the product: do not shorten to mini, micro, or upper-thigh length unless the product is that short.';

const FIDELITY_BAG =
  'Use exactly the bag or accessory from the product image: match shape, straps, hardware, color, material and size. ' +
  'Do not invent a different bag or blend in unrelated items from the person’s original photo.';

const FIDELITY_GLASSES =
  'Use exactly the eyewear from the product image: match frame shape, color, lens style and size. ' +
  'Do not keep unrelated glasses from the original photo unless they are the same product.';

/** Studio / clients that never send a real product caption. */
const GENERIC_TRYVERSE = /^(clothing|bags|glasses)\s+item for virtual try-on\s*$/i;

function isBlankOrGeneric(raw: string): boolean {
  const s = raw.trim();
  if (!s) return true;
  if (GENERIC_TRYVERSE.test(s)) return true;
  if (/^virtual try-on\s*$/i.test(s)) return true;
  return false;
}

/** Exported for FASHN routing when captions are empty or Studio placeholders. */
export function isGenericTryOnDescription(raw: string | null | undefined): boolean {
  return isBlankOrGeneric((raw ?? '').trim());
}

function buildWithDetails(core: string, rawInput: string | null | undefined, maxLen: number): string {
  const raw = (rawInput ?? '').trim();
  if (isBlankOrGeneric(raw)) {
    return core.slice(0, maxLen);
  }
  const merged = `${core} Details: ${raw}`;
  return merged.length <= maxLen ? merged : merged.slice(0, maxLen);
}

/** IDM-VTON `category` slot: full-length vs upper-body garment handling. */
export type IdmVtonGarmentCategory = 'dresses' | 'upper_body';

/** FASHN Try-On `category` (Replicate `fashn/tryon`). `auto` lets the model pick (critical for ghost mannequin + generic captions). */
export type FashnGarmentSlot = 'tops' | 'bottoms' | 'one-pieces' | 'auto';

const FASHN_BOTTOMS_RE =
  /\b(pants?|jeans|trousers|shorts|joggers|leggings|chinos|slacks|\bskirt\b|mini\s*skirt|midi\s*skirt|maxi\s*skirt|cargo)\b/i;

/**
 * Coordinated / full-outfit products — `one-pieces` so FASHN replaces head-to-toe look.
 * Intentionally excludes bare "set" / "outfit" (too many false positives on single tops).
 */
const FASHN_OUTFIT_SET_RE =
  /\b(co-?ords?|matching\s+set|two[\s-]piece|2[\s-]piece|twin[\s-]set|tracksuit|sweatsuit|sweat\s*set|lounge\s*set|(?:denim|knit|linen|matching)\s+set|\bsuit\b|tuxedo|blazer\s*(?:and|&)\s*(?:pant|trouser|short)s?|jumpsuit|playsuit|romper)\b/i;

/** Explicit upper-body catalog copy — shirts/blouses must stay `tops` so shorts/skirts on the model are preserved. */
const FASHN_TOP_STRONG_RE =
  /\b(blouse|shirts?\b|button[-\s]?down|oxford|popover|polo\b|tee\b|t[-\s]?shirts?|tank\b|camisole|cardigan|sweater|pullover|knitwear|hoodie|crew\s*neck|v[-\s]?neck\s*(?:top|shirt|blouse)|tie[-\s]?front|wrap\s+(?:top|blouse|shirt)|cropped?\s+top|crop\s+top|peplum\s+top|tunic\s+top|long\s*sleeve\s+top|bell\s*sleeve|(?<![a-z])top)\b/i;

/** Dress / gown / one-piece only — not bare "maxi"/"midi" (matches maxi skirts/cardigans) or "sleeveless" tops. */
const FASHN_ONE_PIECE_GARMENT_RE =
  /\b(dress|gown|jumpsuit|romper|bodysuit|one[\s-]?piece|mini\s+dress|maxi\s+dress|midi\s+dress|maxi\s+gown|midi\s+gown|wrap\s+dress|sheath|bodycon|frock|ball\s*gown|evening(\s*[-\s])?gown|prom\s*dress|mermaid|column|floor[-\s]?length|full[-\s]?length|tea[-\s]?length)\b/i;

export interface InferFashnGarmentCategoryOpts {
  /** When true, blank/placeholder captions use `auto` so full-length dresses are not forced into `tops`. */
  useAutoForGenericDescription?: boolean;
}

/**
 * Maps product cues to FASHN garment category.
 *
 * Priority order (highest to lowest):
 *  1. Strong shirt/blouse/top copy → `tops` (keeps model’s existing shorts/skirt)
 *  2. Coordinated sets / jumpsuits / rompers → `one-pieces`
 *  3. Bottoms keywords → `bottoms`
 *  4. Dress / gown / full-length garment wording → `one-pieces`
 *  5. Generic/blank description → `auto` (FASHN v1.6)
 *  6. Default → `tops` (never infer `one-pieces` from portrait product crop alone)
 */
export function inferFashnGarmentCategory(
  _productHeightOverWidth?: number,
  productDescription?: string | null,
  opts?: InferFashnGarmentCategoryOpts
): FashnGarmentSlot {
  const raw = (productDescription ?? '').trim();

  // 1. Catalog copy clearly describes an upper-body garment — do not promote to one-piece.
  if (raw && FASHN_TOP_STRONG_RE.test(raw) && !FASHN_ONE_PIECE_GARMENT_RE.test(raw)) {
    return 'tops';
  }

  // 2. Matching sets / jumpsuits / rompers (before bottoms so "shorts + top" co-ords still win)
  if (raw && FASHN_OUTFIT_SET_RE.test(raw)) {
    return 'one-pieces';
  }

  // 3. Bottoms-only keywords (e.g. maxi skirt, jeans)
  if (raw && FASHN_BOTTOMS_RE.test(raw)) {
    return 'bottoms';
  }

  // 4. Dress / gown / explicit full-length garment
  if (raw && FASHN_ONE_PIECE_GARMENT_RE.test(raw)) {
    return 'one-pieces';
  }

  if (raw && IDM_FULL_BODY_GARMENT_RE.test(raw)) {
    return 'one-pieces';
  }

  // 5. Generic/blank → let FASHN auto-detect (full-length ghost mannequin without hurting tops)
  if (opts?.useAutoForGenericDescription && isBlankOrGeneric(raw)) {
    return 'auto';
  }

  // 6. Default: upper-body try-on — preserves shorts unless copy says dress/set/gown.
  return 'tops';
}

export interface IdmGarmentDescriptorOpts {
  /** `height / width` of the optimized product image (e.g. > ~1.35 suggests a long dress). */
  productHeightOverWidth?: number;
  /** When IDM slot is `dresses`, always add full-length hints even if aspect ratio heuristics miss. */
  idmCategory?: IdmVtonGarmentCategory;
}

const IDM_FULL_BODY_GARMENT_RE =
  /\b(dress|gown|jumpsuit|maxi\s+dress|midi\s+dress|maxi\s+gown|frock|romper|sheath|bodycon|jumper(?:\s*[-\s])?dress|ball\s*gown|evening(\s*[-\s])?gown|prom\s*dress|mermaid|column)\b/i;

/**
 * Maps product cues to IDM-VTON category (dresses = full-body, upper_body = tops etc.).
 */
export function inferIdmVtonGarmentCategory(
  productHeightOverWidth?: number,
  productDescription?: string | null
): IdmVtonGarmentCategory {
  const hw = productHeightOverWidth;
  /** Slightly lenient: padded/square ecommerce crops still represent full-length gowns. */
  if (hw !== undefined && Number.isFinite(hw) && hw > 1.06) {
    return 'dresses';
  }
  const raw = (productDescription ?? '').trim();
  if (raw && IDM_FULL_BODY_GARMENT_RE.test(raw)) {
    return 'dresses';
  }
  if (inferIsLongGarment(productHeightOverWidth, productDescription)) {
    return 'dresses';
  }
  return 'upper_body';
}

/** Dress/gown / maxi cues in captions — used even when aspect ratio is ambiguous (e.g. padded catalog shots). */
const LONG_GARMENT_RE =
  /\b(gown|dress|maxi|midi|frock|sheath|bodycon|slip\s*dress|evening(\s*[-\s])?(wear|dress|gown)?|ball\s*gown|bridal|prom\s*dress|mermaid|column|a[-\s]?line|wrap\s*dress|floor[-\s]?length|full[-\s]?length|ankle(\s*length)?|tea[-\s]?length)\b/i;

/**
 * True for tall product frames and/or explicit dress/gown wording.
 * Used to turn off IDM-VTON `is_checked_crop`, which otherwise crops long garments to torso-only.
 */
export function inferIsLongGarment(
  productHeightOverWidth?: number,
  productDescription?: string | null
): boolean {
  const hw = productHeightOverWidth;
  if (hw !== undefined && Number.isFinite(hw) && hw > 1.04) {
    return true;
  }
  const raw = (productDescription ?? '').trim();
  if (raw && LONG_GARMENT_RE.test(raw)) {
    return true;
  }
  return false;
}

/** `garment_des` for IDM-VTON (clothing) — every clothing try-on, all clients. */
export function buildIdmGarmentDescription(
  productDescription?: string | null,
  opts?: IdmGarmentDescriptorOpts
): string {
  let core = FIDELITY_CLOTHING;
  const isLong =
    opts?.idmCategory === 'dresses' ||
    inferIsLongGarment(opts?.productHeightOverWidth, productDescription);
  if (isLong) {
    core += GOWN_LENGTH_HINT;
  }
  return buildWithDetails(core, productDescription, MAX_LEN);
}

/** `garment_description` for FASHN clothing try-on (same family as bags/glasses). */
export function buildFashnClothingDescription(
  productDescription?: string | null,
  opts?: { productHeightOverWidth?: number; fashnCategory?: FashnGarmentSlot }
): string {
  let core = FIDELITY_CLOTHING;
  const cat = opts?.fashnCategory;
  const isLong =
    cat === 'one-pieces' ||
    (cat === 'auto' && inferIsLongGarment(opts?.productHeightOverWidth, productDescription));
  if (isLong) {
    core += GOWN_LENGTH_HINT;
  }
  return buildWithDetails(core, productDescription, MAX_FASHN_LEN);
}

/** `garment_description` for FASHN try-on (bags). */
export function buildFashnBagDescription(productDescription?: string | null): string {
  return buildWithDetails(FIDELITY_BAG, productDescription, MAX_FASHN_LEN);
}

/** `garment_description` for FASHN try-on (glasses). */
export function buildFashnGlassesDescription(productDescription?: string | null): string {
  return buildWithDetails(FIDELITY_GLASSES, productDescription, MAX_FASHN_LEN);
}
