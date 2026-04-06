import termlyPrivacyPolicyHtml from "./termlyPrivacyPolicy.html?raw";
import type { PolicyAudience } from "./policyContent";

/**
 * Termly-generated Privacy Policy. Update `termlyPrivacyPolicy.html` when Termly publishes changes.
 */
export function TermlyPrivacyPolicyContent(_props: { audience?: PolicyAudience }) {
  return (
    <div
      className="termly-privacy-policy text-foreground max-w-none overflow-x-auto [&_h1]:scroll-mt-24 [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24"
      dangerouslySetInnerHTML={{ __html: termlyPrivacyPolicyHtml }}
    />
  );
}
