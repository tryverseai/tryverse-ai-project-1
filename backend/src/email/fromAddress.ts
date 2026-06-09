/**
 * Canonical transactional `From:` for branded TryVerse email (verified in Resend).
 * Prefer this over ENV for product-critical sends so Railway typos can't override silently.
 */
export const TRYVERSE_TRANSACTIONAL_FROM = 'TryVerse AI <info@tryverseai.com>';
