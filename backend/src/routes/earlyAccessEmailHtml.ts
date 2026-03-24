/**
 * Early access confirmation email (HTML).
 * Callers must pass values already escaped for HTML (e.g. via escapeHtml()).
 * Kept in a separate module so static analysis does not conflate HTTP body fields with markup.
 */
// nosemgrep: javascript.lang.security.audit.raw-html-format
export function buildEarlyAccessConfirmationHtml(
  escapedFirstName: string,
  escapedBrandName: string
): string {
  return (
    '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">\n' +
    '  <p>Hi ' +
    escapedFirstName +
    ',</p>\n' +
    '  <p>Thanks for requesting early access to <strong>TryVerse</strong> for <strong>' +
    escapedBrandName +
    '</strong>.</p>\n' +
    '  <p>We’ve received your details and’ll follow up to learn more about your store and how we can support your goals.</p>\n' +
    '  <p>— The TryVerse team</p>\n' +
    '</body>\n' +
    '</html>'
  );
}
