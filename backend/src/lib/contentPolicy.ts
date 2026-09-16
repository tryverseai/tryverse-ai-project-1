import { AppError } from '../middleware/errorHandler';

/**
 * Server-side gate for AI Model Studio's free-text `prompt` (text -> synthetic fashion-model
 * image, no input photo). TryVerse's Terms/AUP prohibit "sexualized content involving minors" and
 * its Privacy Policy states TryVerse "is not intended for children under the age of 13" — but
 * neither document, nor the generation pipeline itself, previously stopped a *non-sexual* request
 * for a photorealistic image of a toddler/child model. There is no legitimate TryVerse use case
 * for that (the product is B2B fashion-brand tooling; every shipped model asset and sample is an
 * adult), upstream AI providers categorically prohibit generating photorealistic minors regardless
 * of sexual content, and the legal/reputational risk is the same class as CSAM-adjacent content.
 * This is therefore enforced as an outright block, not narrowed to sexualized wording only.
 *
 * Deliberately keyword/pattern-based rather than an ML age classifier: this runs before any image
 * exists (the input is a text prompt, not a photo), so there is nothing yet to classify — the only
 * signal available is the words the caller chose. False positives (e.g. a prompt that happens to
 * mention "kid-friendly packaging") are an acceptable cost for a hard content-safety boundary; a
 * rejected prompt can be reworded and resubmitted.
 */
const MINOR_DESCRIPTOR_PATTERNS: RegExp[] = [
  /\b(toddlers?|infants?|newborns?|babies|baby)\b/i,
  /\bpre[- ]?teens?\b/i,
  /\btweens?\b/i,
  /\bunderage\b/i,
  /\bminors?\b/i,
  /\bkindergart(en|ner)\b/i,
  /\belementary[- ]school\b/i,
  /\b(kid|kids|child|children)\b/i,
  // "5 year old", "5-year-old", "5 yo", "age 5", "aged 5" for ages 0-12.
  /\b(0?[0-9]|1[0-2])\s*[- ]?(years?|yrs?|y)\s*[- ]?olds?\b/i,
  /\b(0?[0-9]|1[0-2])\s*[- ]?y\.?o\.?\b/i,
  /\bage[d]?\s*[:\-]?\s*(0?[0-9]|1[0-2])\b(?!\d)/i,
];

export class ProhibitedMinorContentError extends AppError {
  constructor() {
    super(
      'This request describes a child. TryVerse does not generate images depicting minors — describe an adult model instead.',
      422,
      'PROHIBITED_CONTENT_MINOR'
    );
  }
}

/** Throws {@link ProhibitedMinorContentError} if `prompt` appears to describe a minor. */
export function assertPromptDoesNotDescribeAMinor(prompt: string): void {
  for (const pattern of MINOR_DESCRIPTOR_PATTERNS) {
    if (pattern.test(prompt)) {
      throw new ProhibitedMinorContentError();
    }
  }
}
