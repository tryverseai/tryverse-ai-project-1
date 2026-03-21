import { Link } from "react-router-dom";

/**
 * Shared policy content used in full pages and compliance onboarding modal.
 */
export const TermsContent = () => (
  <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
      <p>By accessing or using TryVerse (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Description of Service</h2>
      <p>TryVerse provides AI-powered virtual try-on technology for e-commerce brands. The Service includes an embeddable widget, API access, image processing, and analytics dashboard.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. User Accounts</h2>
      <p>You must create an account to use the Service. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. API Keys & Usage</h2>
      <p>API keys are issued per account and must not be shared. You are responsible for all usage associated with your API keys. TryVerse reserves the right to revoke keys that are misused.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Payment & Billing</h2>
      <p>Paid plans are billed monthly. Payments are processed via Paystack or Flutterwave. Subscriptions auto-renew unless cancelled. Refunds are handled on a case-by-case basis.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Acceptable Use</h2>
      <p>You may not use the Service to process illegal, harmful, or offensive content. TryVerse reserves the right to suspend accounts that violate this policy.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Intellectual Property</h2>
      <p>You retain ownership of images you upload. TryVerse retains ownership of the platform, AI models, and generated outputs. You receive a license to use generated images for commercial purposes within the scope of your subscription.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Limitation of Liability</h2>
      <p>TryVerse is provided &quot;as is&quot; without warranties. We are not liable for indirect, incidental, or consequential damages arising from your use of the Service.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">9. Modifications</h2>
      <p>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
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

export const PrivacyContent = () => (
  <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Information We Collect</h2>
      <p>We collect information you provide directly: account details (email, brand name), product images, and user-uploaded photos for try-on processing. We also collect usage data, device information, and cookies for analytics.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
      <p>We use collected information to: provide the AI try-on service, process payments, send transactional emails, improve our AI models, and provide analytics to brand partners.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Image Processing & Storage</h2>
      <p>User-uploaded photos are processed by our AI engine and stored temporarily for the duration of the try-on session. Product images are cached for performance. All images are encrypted in transit and at rest.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Data Sharing</h2>
      <p>We do not sell personal data. We share data with: payment processors (Paystack/Flutterwave) for billing, AI service providers for image processing, and cloud infrastructure providers for hosting.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Data Retention</h2>
      <p>Account data is retained while your account is active. Try-on images are automatically deleted after 24 hours. Analytics data is retained for 12 months. You may request deletion of your data at any time.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Security</h2>
      <p>We implement industry-standard security measures including encryption, access controls, and regular security audits. API keys are hashed and stored securely.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Your Rights</h2>
      <p>You have the right to: access your data, correct inaccuracies, request deletion, export your data, and withdraw consent for processing. Contact us to exercise these rights.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Cookies</h2>
      <p>We use essential cookies for authentication and preferences. Analytics cookies are used with your consent. You can manage cookie preferences in your browser settings.</p>
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

export const DataProcessingContent = () => (
  <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Scope</h2>
      <p>This Data Processing Agreement (&quot;DPA&quot;) applies to the processing of personal data by TryVerse on behalf of brands (&quot;Data Controllers&quot;) who use our virtual try-on service.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Data Processing Activities</h2>
      <p>TryVerse processes the following data on behalf of brands: end-user uploaded photos for try-on generation, product images, usage analytics, and widget interaction data.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Processing Purpose</h2>
      <p>Data is processed solely for the purpose of providing the virtual try-on service, generating analytics reports, and improving AI model accuracy.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Sub-processors</h2>
      <p>TryVerse uses the following sub-processors: cloud infrastructure providers for hosting and storage, AI model providers for image processing, and payment processors for billing.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Data Security Measures</h2>
      <p>We implement: encryption at rest and in transit, access control and authentication, regular security assessments, incident response procedures, and data backup and recovery systems.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Data Retention & Deletion</h2>
      <p>End-user photos are automatically deleted within 24 hours of processing. Generated try-on images are retained for 7 days. Brands may request immediate deletion of all associated data.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Data Subject Rights</h2>
      <p>TryVerse assists brands in fulfilling data subject rights requests including access, rectification, erasure, and portability within 30 days of receipt.</p>
    </section>
    <section>
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Breach Notification</h2>
      <p>In the event of a data breach, TryVerse will notify the affected brand within 72 hours of becoming aware of the breach, providing details of the nature, scope, and remediation steps.</p>
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
