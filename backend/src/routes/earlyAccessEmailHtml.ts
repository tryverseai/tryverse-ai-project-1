import sanitizeHtml from 'sanitize-html';

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function publicSiteLabel(homeUrl: string): string {
  try {
    return new URL(homeUrl).host;
  } catch {
    return 'tryverseai.com';
  }
}

/** Mutable shapes required by sanitize-html `IOptions` (not `readonly` tuples). */
const SANITIZE_OPTIONS = {
  allowedTags: ['p', 'strong', 'a', 'br'],
  allowedAttributes: { a: ['href'] },
};

function wrapEmailHtml(innerSanitized: string): string {
  return (
    '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.55; color: #111; max-width: 560px;">\n' +
    innerSanitized +
    '\n</body>\n' +
    '</html>'
  );
}

export interface EarlyAccessEmailUrls {
  bookDemoUrl: string;
  homeUrl: string;
}

/**
 * Early access confirmation (brand / business applicants).
 * Callers must pass name values already escaped for HTML text nodes.
 */
export function buildEarlyAccessConfirmationHtml(
  escapedFirstName: string,
  escapedBrandName: string,
  urls: EarlyAccessEmailUrls
): string {
  const hrefDemo = escapeHtmlAttr(urls.bookDemoUrl);
  const hrefHome = escapeHtmlAttr(urls.homeUrl);
  const siteLabel = escapeHtmlAttr(publicSiteLabel(urls.homeUrl));
  const inner =
    '<p>Hi ' +
    escapedFirstName +
    ',</p>' +
    '<p>We\'ve received your request for early access to <strong>TryVerse</strong> for <strong>' +
    escapedBrandName +
    '</strong>.</p>' +
    '<p>We\'re currently in a limited private beta, onboarding select brands and individuals with priority access. Our team will reach out directly with next steps and your invite link as spots become available.</p>' +
    '<p>If you\'d like to explore TryVerse sooner with your team, we\'d love to connect.</p>' +
    '<p><a href="' +
    hrefDemo +
    '">Schedule a Private Demo</a> →</p>' +
    '<p>Thank you for your interest.<br/>— The TryVerse Team</p>' +
    '<p><a href="' +
    hrefHome +
    '">' +
    siteLabel +
    '</a></p>';

  return wrapEmailHtml(sanitizeHtml(inner, SANITIZE_OPTIONS));
}
