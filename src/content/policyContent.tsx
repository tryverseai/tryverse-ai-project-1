import { Link } from "react-router-dom";

export type PolicyAudience = "business" | "individual";

interface PolicyContentProps {
  /** Defaults to business (e.g. public /terms page). */
  audience?: PolicyAudience;
}

export function TermsContent({ audience = "business" }: PolicyContentProps) {
  if (audience === "individual") {
    return (
      <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using TryVerse (&quot;the Service&quot;) as a personal user, you agree to these Terms of
            Service. If you do not agree, do not use the Service.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
          <p>
            TryVerse provides AI-powered virtual try-on for <strong>your personal use</strong>. You can upload your
            photo (or use preset models where available), add product images, and generate try-on results to view and
            download. This personal experience does not include storefront widgets, merchant APIs, or team analytics
            unless you separately use a business account.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. User Accounts</h2>
          <p>
            You must create an account to use the Service. You are responsible for your login details and for all
            activity under your account.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Credits &amp; fair use</h2>
          <p>
            Personal accounts receive a limited number of try-ons and features as described at signup or on your plan.
            You may not automate, resell, or systematically abuse the Service. API keys and embeddable widgets are
            offered under separate business terms.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Payment &amp; billing</h2>
          <p>
            Paid personal plans, where offered, are billed as shown at checkout. Payments may be processed via Paystack
            or Flutterwave. Subscriptions may auto-renew unless cancelled. Refunds are handled on a case-by-case basis.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Acceptable use</h2>
          <p>
            You may not use the Service to process illegal, harmful, or offensive content, or to harass others. TryVerse
            may suspend accounts that violate this policy.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Intellectual property</h2>
          <p>
            You retain ownership of photos you upload. TryVerse retains ownership of the platform, software, and
            underlying AI components. Subject to your plan, you receive a license to use try-on outputs for{" "}
            <strong>personal, non-commercial</strong> use unless your subscription expressly allows broader commercial
            use.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Limitation of liability</h2>
          <p>
            TryVerse is provided &quot;as is&quot; without warranties. We are not liable for indirect, incidental, or
            consequential damages arising from your use of the Service.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">9. Modifications</h2>
          <p>
            We may update these Terms at any time. Continued use after changes constitutes acceptance of the updated
            Terms.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">10. Contact</h2>
          <p>
            For questions about these Terms, please use our{" "}
            <Link to="/support" className="text-foreground underline font-medium">
              Contact us
            </Link>{" "}
            page.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
        <p>
          By accessing or using TryVerse (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If
          you do not agree, do not use the Service.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
        <p>
          TryVerse provides AI-powered virtual try-on technology for e-commerce brands. The Service includes an
          embeddable widget, API access, image processing, and analytics dashboard.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. User Accounts</h2>
        <p>
          You must create an account to use the Service. You are responsible for maintaining the confidentiality of your
          account credentials and for all activities under your account.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. API Keys &amp; Usage</h2>
        <p>
          API keys are issued per account and must not be shared. You are responsible for all usage associated with your
          API keys. TryVerse reserves the right to revoke keys that are misused.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Payment &amp; Billing</h2>
        <p>
          Paid plans are billed monthly. Payments are processed via Paystack or Flutterwave. Subscriptions auto-renew
          unless cancelled. Refunds are handled on a case-by-case basis.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Acceptable Use</h2>
        <p>
          You may not use the Service to process illegal, harmful, or offensive content. TryVerse reserves the right to
          suspend accounts that violate this policy.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Intellectual Property</h2>
        <p>
          You retain ownership of images you upload. TryVerse retains ownership of the platform, AI models, and generated
          outputs. You receive a license to use generated images for commercial purposes within the scope of your
          subscription.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Limitation of Liability</h2>
        <p>
          TryVerse is provided &quot;as is&quot; without warranties. We are not liable for indirect, incidental, or
          consequential damages arising from your use of the Service.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">9. Modifications</h2>
        <p>
          We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the
          new Terms.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">10. Contact</h2>
        <p>
          For questions about these Terms, please use our{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}

export function PrivacyContent({ audience = "business" }: PolicyContentProps) {
  if (audience === "individual") {
    return (
      <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Information we collect</h2>
          <p>
            We collect what you provide: account details (email, name), photos you upload for try-on, product images you
            use with the tool, and optional profile information. We also collect usage data, device information, and
            cookies for security and analytics.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. How we use your information</h2>
          <p>
            We use it to run your try-ons, operate and improve the Service, process payments if you purchase a plan, send
            transactional emails (e.g. sign-in, receipts), and maintain the security of the platform. We do{" "}
            <strong>not</strong> use your personal try-on photos to market third-party brands to you.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Image processing &amp; storage</h2>
          <p>
            Your photos are processed by our AI systems and stored only as long as needed to provide results and
            short-term product performance. Product images may be cached. Data is encrypted in transit and protected at
            rest per our security practices.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Data sharing</h2>
          <p>
            We do not sell your personal data. We share data with service providers as needed: payment processors
            (Paystack/Flutterwave), AI and hosting vendors that process or store content under contract, and as required
            by law.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Data retention</h2>
          <p>
            Account data is kept while your account is active. Try-on-related images may be deleted automatically after
            short retention periods described in our systems. Analytics may be retained for a limited period. You may
            request deletion of your data.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Security</h2>
          <p>
            We implement industry-standard measures including encryption, access controls, and monitoring. Where API
            keys apply to business accounts, they are stored securely.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Your rights</h2>
          <p>
            Depending on your region, you may have rights to access, correct, delete, or export your data, and to object
            to certain processing. Contact us to exercise these rights.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Cookies</h2>
          <p>
            We use essential cookies for authentication. Analytics cookies may be used with your consent where required.
            You can control cookies in your browser.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg font-semibold text-foreground mb-3">9. Contact</h2>
          <p>
            For privacy inquiries, please use our{" "}
            <Link to="/support" className="text-foreground underline font-medium">
              Contact us
            </Link>{" "}
            page.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
        <p>
          We collect information you provide directly: account details (email, brand name), product images, and
          user-uploaded photos for try-on processing. We also collect usage data, device information, and cookies for
          analytics.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
        <p>
          We use collected information to: provide the AI try-on service, process payments, send transactional emails,
          improve our AI models, and provide analytics to brand partners.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Image Processing & Storage</h2>
        <p>
          User-uploaded photos are processed by our AI engine and stored temporarily for the duration of the try-on
          session. Product images are cached for performance. All images are encrypted in transit and at rest.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Data Sharing</h2>
        <p>
          We do not sell personal data. We share data with: payment processors (Paystack/Flutterwave) for billing, AI
          service providers for image processing, and cloud infrastructure providers for hosting.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Data Retention</h2>
        <p>
          Account data is retained while your account is active. Try-on images are automatically deleted after 24
          hours. Analytics data is retained for 12 months. You may request deletion of your data at any time.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Security</h2>
        <p>
          We implement industry-standard security measures including encryption, access controls, and regular security
          audits. API keys are hashed and stored securely.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Your Rights</h2>
        <p>
          You have the right to: access your data, correct inaccuracies, request deletion, export your data, and
          withdraw consent for processing. Contact us to exercise these rights.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Cookies</h2>
        <p>
          We use essential cookies for authentication and preferences. Analytics cookies are used with your consent. You
          can manage cookie preferences in your browser settings.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">9. Contact</h2>
        <p>
          For privacy inquiries, please use our{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}

/** Business / merchant DPA (processor relationship). */
export function DataProcessingContent(_props: PolicyContentProps = {}) {
  return (
    <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Scope</h2>
        <p>
          This Data Processing Agreement (&quot;DPA&quot;) applies to the processing of personal data by TryVerse on
          behalf of brands (&quot;Data Controllers&quot;) who use our virtual try-on service.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Data Processing Activities</h2>
        <p>
          TryVerse processes the following data on behalf of brands: end-user uploaded photos for try-on generation,
          product images, usage analytics, and widget interaction data.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Processing Purpose</h2>
        <p>
          Data is processed solely for the purpose of providing the virtual try-on service, generating analytics
          reports, and improving AI model accuracy.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Sub-processors</h2>
        <p>
          TryVerse uses the following sub-processors: cloud infrastructure providers for hosting and storage, AI model
          providers for image processing, and payment processors for billing.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Data Security Measures</h2>
        <p>
          We implement: encryption at rest and in transit, access control and authentication, regular security
          assessments, incident response procedures, and data backup and recovery systems.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Data Retention & Deletion</h2>
        <p>
          End-user photos are automatically deleted within 24 hours of processing. Generated try-on images are retained
          for 7 days. Brands may request immediate deletion of all associated data.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Data Subject Rights</h2>
        <p>
          TryVerse assists brands in fulfilling data subject rights requests including access, rectification, erasure,
          and portability within 30 days of receipt.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Breach Notification</h2>
        <p>
          In the event of a data breach, TryVerse will notify the affected brand within 72 hours of becoming aware of
          the breach, providing details of the nature, scope, and remediation steps.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">9. Contact</h2>
        <p>
          For DPA inquiries, please use our{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}

/** Cookie Policy — matches the categories actually offered in CookieConsent.tsx. */
export function CookiePolicyContent(_props: PolicyContentProps = {}) {
  return (
    <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. What cookies are</h2>
        <p>
          Cookies are small text files stored on your device. We also use equivalent local-storage
          entries in your browser for the same purposes described below.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Essential cookies (always on)</h2>
        <p>
          Required for the Service to function: keeping you signed in (Convex Auth session), remembering
          your cookie preference, CSRF/security protections, and load-balancing. These cannot be disabled
          without breaking core functionality — declining non-essential cookies in our consent banner
          never disables these.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Analytics cookies (optional)</h2>
        <p>
          When enabled, we use PostHog to understand feature usage and improve the product — page views,
          button clicks, and try-on funnel completion. PostHog is configured with a public project key and
          does not receive your uploaded photos. You can decline analytics cookies at any time from the
          cookie banner or the &quot;Cookie Settings&quot; link in the footer; declining stops new analytics
          events from being sent.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Error monitoring</h2>
        <p>
          Where enabled, Sentry captures crash reports and error traces to help us fix bugs. This is
          operational, not marketing, tracking, and is not affected by the analytics cookie toggle.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. No third-party advertising cookies</h2>
        <p>
          We do not run advertising or cross-site retargeting cookies, and we do not sell data derived from
          cookies to advertisers.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Managing your preference</h2>
        <p>
          Use the &quot;Cookie Settings&quot; link in the footer at any time to change your choice, or clear
          cookies/local storage in your browser to reset it. Blocking essential cookies in your browser
          settings may prevent sign-in from working.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Contact</h2>
        <p>
          Questions about cookies — use our{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}

/** Acceptable Use Policy — specific to an AI image-generation / virtual try-on product. */
export function AcceptableUsePolicyContent(_props: PolicyContentProps = {}) {
  return (
    <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Purpose</h2>
        <p>
          This Acceptable Use Policy applies to everyone who uses TryVerse — brand teams, their shoppers via
          the embedded widget, and personal accounts. It exists because TryVerse generates images of real
          people; misuse has real consequences for the people in those photos.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Consent for uploaded photos</h2>
        <p>
          Only upload a photo of yourself, or of someone else who has given you clear permission to generate
          try-on or personalization images of them. Uploading a photo of another person without their
          consent — including images taken from the internet, a screenshot, or a hidden/candid photo — is
          prohibited.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. No deceptive product imagery</h2>
        <p>
          Brands may not use TryVerse-generated images to misrepresent a product's actual appearance, fit,
          fabric, or color in a way intended to mislead shoppers into a purchase they wouldn't otherwise
          make. Generated imagery must be a fair representation of the underlying product.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Prohibited content</h2>
        <p>
          No uploads or generated output involving: minors in sexualized contexts, non-consensual intimate
          imagery, content that impersonates a real person to defame or defraud them, hate symbols or content
          promoting violence, or anything illegal in your jurisdiction.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. No abuse of the platform</h2>
        <p>
          Do not attempt to bypass rate limits, API key restrictions, credit limits, or domain allowlists;
          scrape or reverse-engineer the Service; share or resell API keys; or use automated bulk requests
          outside your plan's intended usage.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Brand responsibilities for shopper data</h2>
        <p>
          Brands embedding the widget are responsible for having a lawful basis to let their own shoppers
          upload photos through it (typically the shopper's own action and consent at the point of upload),
          and for their own privacy disclosures on their storefront. TryVerse processes that shopper data as
          described in our{" "}
          <Link to="/data-processing" className="text-foreground underline font-medium">
            Data Processing Agreement
          </Link>
          .
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Enforcement</h2>
        <p>
          Violations may result in content removal, credit forfeiture, API key revocation, or account
          suspension or termination, at TryVerse's discretion, with or without notice for serious violations.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Reporting misuse</h2>
        <p>
          If you believe TryVerse is being used to generate or host content that violates this policy,
          contact us via{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          and we will investigate.
        </p>
      </section>
    </div>
  );
}

/**
 * Personal accounts: data-processing notice structured like the merchant DPA, but written for
 * end users (you use TryVerse for yourself, not as a store controller).
 */
export function PersonalDataNoticeContent(_props: PolicyContentProps = {}) {
  return (
    <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Scope</h2>
        <p>
          This notice describes how TryVerse processes <strong>your</strong> personal information when you use a{" "}
          <strong>personal TryVerse account</strong> for virtual try-on. You are the person the data is about — we are
          not processing on behalf of your store (for merchant terms, see a business account).
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Data we process</h2>
        <p>
          We process account details (email, name), photos you upload for try-on, product images you provide, usage and
          device data, and cookies as described in the <strong>Privacy Policy</strong> step.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Purpose</h2>
        <p>
          Data is used to run your try-ons, show results in your dashboard, keep your account secure, improve the
          Service, and send transactional messages (not for third-party brand marketing on your behalf).
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Who we rely on</h2>
        <p>
          We use hosting, AI, and payment partners under contract where needed — the same categories described in our
          Privacy Policy (e.g. infrastructure, model providers, Paystack/Flutterwave if you pay).
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Security</h2>
        <p>
          We use encryption in transit, access controls, and other industry-standard measures. Personal accounts do not
          receive API keys; business features stay on business accounts.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Retention &amp; deletion</h2>
        <p>
          Try-on-related images are kept only as long as needed for you to retrieve results and to operate the Service
          safely, then deleted or minimized per our schedule (see Privacy Policy for typical windows).
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Your rights</h2>
        <p>
          You may ask for access, correction, deletion, or export of your data where applicable.{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          to exercise these rights.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Questions or concerns</h2>
        <p>
          If you believe something is wrong with how we handle your data, reach out via{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>
          ; we&apos;ll respond within a reasonable time.
        </p>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold text-foreground mb-3">9. Contact</h2>
        <p>
          For this notice or your personal data, use our{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}
