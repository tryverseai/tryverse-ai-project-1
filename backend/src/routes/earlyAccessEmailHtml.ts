import sanitizeHtml from 'sanitize-html';

/**
 * Early access confirmation email (HTML).
 * Callers must pass values already escaped for HTML (e.g. via escapeHtml()).
 * Output is passed through sanitize-html with a strict allowlist for defense in depth.
 */
export function buildEarlyAccessConfirmationHtml(
  escapedFirstName: string,
  escapedBrandName: string
): string {
  const inner =
    '<p>Hi ' +
    escapedFirstName +
    ',</p>' +
    '<p>Thanks for requesting early access to <strong>TryVerse</strong> for <strong>' +
    escapedBrandName +
    '</strong>.</p>' +
    '<p>We’ve received your details and’ll follow up to learn more about your store and how we can support your goals.</p>' +
    '<p>— The TryVerse team</p>';

  const sanitized = sanitizeHtml(inner, {
    allowedTags: ['p', 'strong'],
    allowedAttributes: {},
  });

  return (
    '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">\n' +
    sanitized +
    '\n</body>\n' +
    '</html>'
  );
}
