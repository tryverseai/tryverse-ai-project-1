import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

/**
 * TryVerse is B2B-only. This alias is retained (rather than deleted) so the prop threading in
 * `ComplianceOnboardingModal` / `TryVersePrivacyPolicy` keeps compiling; there is only one
 * audience now.
 */
export type PolicyAudience = "business";

interface PolicyContentProps {
  /** Always "business" — TryVerse has no individual/consumer account type. */
  audience?: PolicyAudience;
}

/** Bump whenever the published legal-policy set materially changes. Mirrors CURRENT_POLICY_VERSION in convex/profiles.ts. */
export const CURRENT_POLICY_VERSION = "2026-08-24";

/** Shown on the two documents (Terms, Privacy) that still have real business/legal decisions pending with counsel. */
function PendingCounselNote({ items }: { items: string }) {
  return (
    <Alert className="not-prose mb-2 border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
      <Info className="h-4 w-4" />
      <AlertDescription>
        This document is drafted and in effect, but {items} are still pending final confirmation with legal counsel
        and will be updated once resolved. Contact{" "}
        <Link to="/support" className="underline font-medium">
          our support
        </Link>{" "}
        if you need the current status of any pending item.
      </AlertDescription>
    </Alert>
  );
}

const h2 = "font-display text-lg font-semibold text-foreground mb-3";
const prose = "prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed";

export function TermsContent(_props: PolicyContentProps = {}) {
  return (
    <div className={prose}>
      <PendingCounselNote items="the registered legal entity name, address and jurisdiction, the governing-law jurisdiction, the dispute-resolution venue, and the fixed-amount floor on our liability cap" />
      <section>
        <h2 className={h2}>1. Agreement and Acceptance</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern access to and use of TryVerse (&quot;TryVerse,&quot;
          &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), including the TryVerse website, applications,
          dashboards, Personal Studio, virtual Try-On, Complete Outfit/Outfit Builder, AI Model Studio, AI Model
          Generation, AI Photoshoot, Product Photography, AI Video, Connect Store, embedded storefront tools, APIs,
          SDKs, developer tools, analytics, storage, and related services (collectively, the &quot;Service&quot;).
        </p>
        <p>
          By creating an account, clicking an acceptance control, purchasing a plan, connecting a store, integrating
          an API/SDK, embedding a TryVerse widget, or otherwise using the Service, you agree to these Terms and the
          policies incorporated into them. If you do not agree, do not use the Service.
        </p>
        <p>
          If you use TryVerse on behalf of a company or organization, you represent that you have authority to bind
          that organization.
        </p>
      </section>
      <section>
        <h2 className={h2}>2. Definitions and Accounts</h2>
        <p>
          &quot;TryVerse&quot; refers to the service operated by TryVerse AI
          (<span className="font-medium">[LEGAL ENTITY NAME &mdash; TO BE CONFIRMED BY COUNSEL]</span>).
          &quot;Customer&quot; means the business, brand, organization, or other commercial entity that holds a
          TryVerse account. &quot;Authorized User&quot; means a natural person the Customer permits to access or
          administer that account (for example an owner, employee, contractor, or agency operator).
          &quot;Shopper&quot; or &quot;End User&quot; means a person who interacts with a TryVerse-powered
          experience that a Customer provides to or for its own customers. TryVerse accounts are business
          accounts; TryVerse does not offer a separate individual or consumer account type.
        </p>
        <p>
          You must have the legal capacity and authority required by applicable law to enter into these Terms on
          behalf of the Customer. TryVerse is not directed to children below the minimum age permitted by applicable
          law. The Customer and its Authorized Users must provide accurate account information and keep it current,
          and are responsible for safeguarding credentials and API keys and for all activity occurring through the
          account, except to the extent caused by TryVerse&rsquo;s failure to apply reasonable security measures.
        </p>
        <p>
          TryVerse may require email verification, device verification, multi-factor authentication, or other
          security controls. You must promptly notify TryVerse of suspected unauthorized access.
        </p>
      </section>
      <section>
        <h2 className={h2}>3. Service and Product Features</h2>
        <p>
          TryVerse provides AI-assisted fashion visualization and content-generation functionality. Depending on the
          plan and availability, the Service may include virtual Try-On, Complete Outfit/Outfit Builder, Personal
          Studio, AI Model Studio, AI Model Generation, AI Photoshoot, Product Photography, AI Video, My Creations,
          Connect Store, embedded storefront functionality, APIs, SDKs, developer tooling, product catalogue
          management, usage/credit controls, and analytics.
        </p>
        <p>
          Features may be introduced as beta or preview functionality. TryVerse may modify, suspend, or discontinue
          features when reasonably necessary for security, legal compliance, technical or provider changes,
          maintenance, or business reasons.
        </p>
      </section>
      <section>
        <h2 className={h2}>4. Try-On Guide and User Acknowledgment</h2>
        <p>
          Certain Try-On flows require an acknowledgment screen before generation. Where implemented, the user must
          affirmatively select &quot;I Understand &amp; Continue&quot; or an equivalent control before the gated flow
          proceeds. The acknowledgment is an informational product control and does not itself establish consent
          where a separate legal consent or lawful basis is required.
        </p>
      </section>
      <section>
        <h2 className={h2}>5. User Content, Photos and Permissions</h2>
        <p>
          &quot;User Content&quot; includes photographs, product images, prompts, text, model references, product
          catalogue information, and other materials submitted to the Service. You retain whatever rights you have
          in User Content. You grant TryVerse the limited rights necessary to host, store, reproduce, transmit,
          transform, and process User Content to provide, secure, troubleshoot, and maintain the Service and to
          perform the operations described in the{" "}
          <Link to="/privacy" className="text-foreground underline font-medium">
            Privacy Policy
          </Link>{" "}
          and applicable{" "}
          <Link to="/data-processing" className="text-foreground underline font-medium">
            DPA
          </Link>
          .
        </p>
        <p>
          You represent that you have the rights, permissions, and lawful basis necessary to submit the content and
          instruct TryVerse to process it. You must not upload another person&rsquo;s photograph without appropriate
          permission or another lawful basis. Brands are responsible for ensuring their shopper-facing storefronts
          provide legally adequate privacy disclosures and collection mechanisms.
        </p>
      </section>
      <section>
        <h2 className={h2}>6. AI Outputs and Generated Content</h2>
        <p>
          TryVerse may generate images, videos, synthetic models, try-on results, outfit visualizations,
          photoshoots, and product photographs (&quot;Generated Content&quot;). AI-generated output can contain
          inaccuracies, artifacts, omissions, unexpected changes, or other defects.
        </p>
        <p>
          Virtual Try-On is a visualization and is not a guarantee of fit, sizing, drape, color, fabric behavior,
          product performance, or appearance in real life. Product Photography and Photoshoot outputs must be
          reviewed before commercial publication. Generated Content is not guaranteed to be unique or error-free.
          Unless otherwise agreed in writing, you are responsible for reviewing outputs before publication,
          advertising, sale, distribution, or other use.
        </p>
      </section>
      <section>
        <h2 className={h2}>7. My Creations and Persistent User Libraries</h2>
        <p>
          Successful generations may be saved to the authenticated user&rsquo;s My Creations library and remain
          available across logout, browser closure, and device changes until the user deletes the creation, deletes
          the account, or a documented legal/retention requirement requires deletion. The Service may retain
          operational records for failed generations for security, troubleshooting, billing, abuse prevention, and
          analytics even where a failed generation does not appear as a successful creation. TryVerse may apply
          reasonable storage, bandwidth, or plan limits.
        </p>
      </section>
      <section>
        <h2 className={h2}>8. User-Generated AI Models</h2>
        <p>
          A model generated by a user is that user&rsquo;s creation, stored in the user&rsquo;s account library
          rather than added to TryVerse&rsquo;s global model catalogue. Where supported, users may view, download,
          delete, and reuse their generated models. The user remains responsible for any rights, permissions,
          likeness rights, trademarks, or other third-party rights involved in the inputs used to create the model.
        </p>
      </section>
      <section>
        <h2 className={h2}>9. Credits and Usage</h2>
        <p>
          TryVerse may use Credits or other usage units to measure generation activity. Credits are usage units and
          are not cash, deposits, securities, or transferable property unless applicable law requires otherwise. The
          number of Credits required may vary by feature, output type, resolution, duration, or other published
          usage parameters. The generation workflow charges applicable usage; saving a result to My Creations does
          not independently charge Credits.
        </p>
      </section>
      <section>
        <h2 className={h2}>10. Subscriptions, Billing and Payments</h2>
        <p>
          Paid plans, pricing, included usage, renewal terms, taxes, and applicable overages are presented at
          purchase or in an applicable order form. Payments are processed by third-party payment processors; TryVerse
          does not store full payment-card numbers where the payment processor can process those credentials
          directly. Subscriptions renew automatically until cancelled. Refunds, credits, cancellations, and
          chargebacks are governed by the applicable plan terms and by any mandatory protections under applicable
          law that cannot lawfully be excluded.
        </p>
      </section>
      <section>
        <h2 className={h2}>11. API, SDK and Developer Use</h2>
        <p>
          API keys and developer credentials are confidential. You must not expose secrets in public repositories,
          browser bundles, source code intended for public distribution, or client-side applications unless the
          credential is specifically designed for public use. You must implement appropriate authentication,
          authorization, secret management, and rate limiting. You must not use the API to bypass quotas, Credits,
          domain allowlists, or security controls; scrape private data; probe other accounts; or reverse-engineer
          non-public infrastructure.
        </p>
      </section>
      <section>
        <h2 className={h2}>12. Connect Store and Brand Responsibilities</h2>
        <p>
          Brands connecting a store or embedding TryVerse are responsible for their store, domain, catalogue data,
          integration code, shopper notices, and lawful basis for shopper-submitted information. A Brand must not
          represent Generated Content as a guarantee of product fit or physical characteristics, and must review
          generated imagery for material inaccuracies before use. TryVerse may require domain verification,
          allowlists, API credentials, or other controls before enabling a production storefront integration.
        </p>
      </section>
      <section>
        <h2 className={h2}>13. Intellectual Property</h2>
        <p>
          TryVerse and its licensors retain all rights in the Service, software, interfaces, documentation,
          trademarks, branding, non-public infrastructure, architecture, internal tools, and related technology. You
          retain rights in your User Content subject to the license necessary to operate the Service. Subject to
          third-party rights, applicable law, and your plan or written agreement, TryVerse grants you the rights it
          is legally able to grant in Generated Content produced for your account. No right is granted to use
          TryVerse trademarks or to represent that TryVerse endorses a product, campaign, or publication.
        </p>
      </section>
      <section>
        <h2 className={h2}>14. Privacy and Data Processing</h2>
        <p>
          The{" "}
          <Link to="/privacy" className="text-foreground underline font-medium">
            Privacy Policy
          </Link>{" "}
          describes TryVerse&rsquo;s processing of personal data where TryVerse acts as a controller (including
          account, authentication, billing, and platform-security data). Where a Customer determines the purposes and
          means of processing its Shoppers&rsquo; personal data and TryVerse acts on the Customer&rsquo;s
          instructions, the{" "}
          <Link to="/data-processing" className="text-foreground underline font-medium">
            Data Processing Agreement
          </Link>{" "}
          applies to the relevant processing. Nothing in these Terms prevents a party from complying with mandatory
          privacy or data-protection law.
        </p>
      </section>
      <section>
        <h2 className={h2}>15. Acceptable Use and Responsible AI</h2>
        <p>
          You must comply with the{" "}
          <Link to="/acceptable-use" className="text-foreground underline font-medium">
            Acceptable Use &amp; Responsible AI/Image Policy
          </Link>
          . Prohibited conduct includes non-consensual image generation, sexualized content involving minors,
          non-consensual intimate imagery, fraud or defamation through impersonation, unlawful content, deceptive
          product imagery, credential abuse, rate-limit bypass, unauthorized scraping, and attacks against the
          Service.
        </p>
      </section>
      <section>
        <h2 className={h2}>16. Security and Responsible Disclosure</h2>
        <p>
          You must not attack, disrupt, scan, exploit, or compromise TryVerse except under an expressly authorized
          security-testing arrangement. If you identify a vulnerability, report it to{" "}
          <a href="mailto:info@tryverseai.com" className="text-foreground underline font-medium">
            info@tryverseai.com
          </a>
          . TryVerse may suspend access where necessary to contain an active security threat or protect users and
          infrastructure.
        </p>
      </section>
      <section>
        <h2 className={h2}>17. Third-Party Services</h2>
        <p>
          TryVerse relies on third-party hosting, storage, payment, email, analytics, security, and AI-processing
          infrastructure, and may change providers over time. Provider-specific infrastructure is an internal
          implementation detail of the product experience; disclosures required by applicable privacy law or a DPA
          are handled through the Privacy Policy and applicable subprocessor terms.
        </p>
      </section>
      <section>
        <h2 className={h2}>18. Availability and Warranties</h2>
        <p>
          To the maximum extent permitted by law, the Service is provided on an &quot;as is&quot; and &quot;as
          available&quot; basis. TryVerse does not warrant uninterrupted availability, perfect output accuracy,
          error-free operation, specific commercial results, or that every generated image or video will be suitable
          for a particular use. Nothing in these Terms excludes a warranty or right that cannot lawfully be
          excluded.
        </p>
      </section>
      <section>
        <h2 className={h2}>19. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable law, TryVerse will not be liable for indirect, incidental,
          special, consequential, exemplary, or punitive damages, or for loss of profits, revenue, goodwill, or data
          arising from the Service. TryVerse&rsquo;s aggregate liability arising from the Service is limited to the
          fees paid by the claimant to TryVerse during the 12-month period preceding the event giving rise to the
          claim, except to the extent prohibited by law.{" "}
          <span className="italic">
            A fixed-amount minimum floor on this cap, and any tailoring needed for gross negligence, fraud,
            confidentiality, or privacy/security-breach claims, is still being finalized with counsel.
          </span>
        </p>
      </section>
      <section>
        <h2 className={h2}>20. Indemnification</h2>
        <p>
          To the extent permitted by law, you will defend, indemnify, and hold harmless TryVerse and its affiliates,
          officers, directors, employees, and agents from third-party claims arising from your unlawful use of the
          Service, User Content, violation of these Terms, infringement caused by your materials, or breach of your
          obligations. Enterprise agreements may modify this allocation.
        </p>
      </section>
      <section>
        <h2 className={h2}>21. Suspension and Termination</h2>
        <p>
          TryVerse may suspend or terminate access where reasonably necessary to prevent harm, address security
          incidents, enforce the Terms, comply with law, collect unpaid amounts, or protect the Service. You may stop
          using the Service and request account deletion. Upon termination, access and applicable licenses end, while
          provisions intended to survive will continue. Data deletion is governed by the Privacy Policy, DPA,
          applicable retention requirements, and deletion workflows.
        </p>
      </section>
      <section>
        <h2 className={h2}>22. Governing Law and Dispute Resolution</h2>
        <p className="italic">
          The governing law, dispute-resolution mechanism, and venue for these Terms are being finalized with counsel
          and will be published here once confirmed. Nothing in this section limits any mandatory statutory right
          that applies to you under the law of your own jurisdiction.
        </p>
      </section>
      <section>
        <h2 className={h2}>23. Changes to the Terms</h2>
        <p>
          TryVerse may update these Terms. Material changes will be communicated through reasonable channels where
          required by law. The effective date will appear at the top of the published version.
        </p>
      </section>
      <section>
        <h2 className={h2}>24. General</h2>
        <p>
          These Terms, the Privacy Policy, DPA, Cookie Policy, Acceptable Use Policy, and applicable order forms
          constitute the agreement for the relevant Service. If a provision is unenforceable, it will be modified or
          severed to the minimum extent necessary. A failure to enforce a provision is not a waiver. Assignment is
          restricted except as permitted by the agreement or in connection with a merger, acquisition,
          reorganization, or sale of relevant assets.
        </p>
      </section>
      <section>
        <h2 className={h2}>25. Contact</h2>
        <p>
          Legal, privacy, security, and support inquiries can all be sent to{" "}
          <a href="mailto:info@tryverseai.com" className="text-foreground underline font-medium">
            info@tryverseai.com
          </a>{" "}
          or via our{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          page. TryVerse is operated by <span className="font-medium">[LEGAL ENTITY NAME &mdash; TO BE CONFIRMED BY
          COUNSEL]</span>, <span className="font-medium">[REGISTERED ADDRESS &mdash; TO BE CONFIRMED]</span>,{" "}
          <span className="font-medium">[JURISDICTION &mdash; TO BE CONFIRMED BY COUNSEL]</span>. Formal legal
          notices may also be sent to <span className="font-medium">[LEGAL CONTACT EMAIL &mdash; TO BE
          CONFIRMED]</span>.
        </p>
      </section>
    </div>
  );
}

/** Business/merchant DPA (processor relationship). */
export function DataProcessingContent(_props: PolicyContentProps = {}) {
  return (
    <div className={prose}>
      <section>
        <h2 className={h2}>1. Parties and Scope</h2>
        <p>
          This Data Processing Agreement (&quot;DPA&quot;) forms part of the agreement between TryVerse AI
          (<span className="font-medium">[LEGAL ENTITY NAME &mdash; TO BE CONFIRMED BY COUNSEL]</span>;
          &quot;TryVerse,&quot; &quot;Processor&quot;) and the Customer identified in the applicable order form or
          account (&quot;Controller&quot;) where TryVerse processes personal data on the Controller&rsquo;s behalf.
          It applies to Shopper/subject images, product images, Generated Content, interaction data, and other
          personal data submitted through the TryVerse dashboard, API, SDK, embeddable widget, or other
          integrations where TryVerse acts as Processor.
        </p>
      </section>
      <section>
        <h2 className={h2}>2. Roles</h2>
        <p>
          The Controller (the Customer) determines the purposes and means of processing its Shoppers&rsquo; and
          other end users&rsquo; personal data. TryVerse processes that personal data only on documented
          instructions from the Controller except where applicable law requires otherwise. Where TryVerse acts as a
          controller in its own right &mdash; for example for the Customer&rsquo;s account, authentication, and
          billing records, or for platform security and abuse prevention &mdash; that processing is governed by the{" "}
          <Link to="/privacy" className="text-foreground underline font-medium">
            Privacy Policy
          </Link>{" "}
          rather than this DPA.
        </p>
      </section>
      <section>
        <h2 className={h2}>3. Documented Instructions</h2>
        <p>
          TryVerse will process personal data only to provide the Services — virtual Try-On, Complete
          Outfit/Outfit Builder, Personal Studio, AI Model Studio, AI Photoshoot, Product Photography, AI Video
          generation, storage, delivery, security, support, usage metering, and other documented service functions.
        </p>
      </section>
      <section>
        <h2 className={h2}>4. Categories of Data</h2>
        <p>
          Depending on the feature, personal data may include photographs or visual representations of individuals,
          product images, account identifiers, technical information, usage information, prompts/settings, and
          Generated Content. Brands should not submit sensitive or special-category data unless expressly supported,
          lawful, and contractually authorized.
        </p>
      </section>
      <section>
        <h2 className={h2}>5. Data Security Measures</h2>
        <p>
          TryVerse maintains appropriate technical and organizational measures proportionate to the risk, including
          encryption in transit, access controls and authentication, scoped credentials, server-side authorization,
          storage access controls, logging, monitoring, vulnerability management, backups, and incident response.
        </p>
      </section>
      <section>
        <h2 className={h2}>6. Retention and Deletion</h2>
        <p>
          Reference photos submitted through the anonymous storefront widget are held only for the duration of the
          active processing session and automatically deleted after 7 days. Dashboard-based generations created by an
          Authorized User in a signed-in business account are retained as My Creations until they are deleted or the
          account is closed. Upon termination, TryVerse will delete or return remaining Controller personal data as instructed,
          except where retention is required by law or necessary for legitimate security, fraud, billing, dispute, or
          backup purposes.
        </p>
      </section>
      <section>
        <h2 className={h2}>7. Confidentiality</h2>
        <p>
          Personnel authorized to process personal data are subject to confidentiality obligations, and access is
          limited to personnel and systems with a need to know.
        </p>
      </section>
      <section>
        <h2 className={h2}>8. Subprocessors</h2>
        <p>
          TryVerse may engage subprocessors to provide hosting/storage, AI processing, payment, email, analytics,
          security, and related infrastructure, and will provide notice of material changes where required by
          applicable law or contract. TryVerse remains responsible for the processor obligations it has delegated to
          a subprocessor, subject to the agreement and applicable law.
        </p>
      </section>
      <section>
        <h2 className={h2}>9. Data Subject Requests</h2>
        <p>
          TryVerse assists brands in fulfilling data-subject rights requests including access, rectification,
          erasure, and portability within 30 days of receipt. The Controller remains responsible for responding to
          its end users unless applicable law provides otherwise.
        </p>
      </section>
      <section>
        <h2 className={h2}>10. Security Incidents</h2>
        <p>
          TryVerse will maintain an incident-response process and will notify the affected brand within 72 hours of
          confirming a personal-data breach affecting the Controller&rsquo;s data, including — to the extent known —
          the nature of the incident, categories of affected data, likely consequences, and remediation measures.
        </p>
      </section>
      <section>
        <h2 className={h2}>11. International Transfers</h2>
        <p>
          Where personal data is transferred internationally, TryVerse will implement the transfer mechanism required
          by applicable law, which may include standard contractual clauses, adequacy decisions, or other lawful
          safeguards.
        </p>
      </section>
      <section>
        <h2 className={h2}>12. Audits and Evidence</h2>
        <p>
          TryVerse will make available reasonable information demonstrating compliance with its processor
          obligations, subject to confidentiality, security, and proportionality restrictions. Audit rights do not
          permit a customer to access another customer&rsquo;s data or TryVerse&rsquo;s security-sensitive
          infrastructure.
        </p>
      </section>
      <section>
        <h2 className={h2}>13. Controller Responsibilities</h2>
        <p>
          The Controller will establish an appropriate lawful basis, provide privacy notices, obtain required
          consents, honor end-user rights, configure the Service lawfully, and ensure submitted data is accurate and
          authorized.
        </p>
      </section>
      <section>
        <h2 className={h2}>14. Contact</h2>
        <p>
          For DPA inquiries, please use our{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          page or email{" "}
          <a href="mailto:info@tryverseai.com" className="text-foreground underline font-medium">
            info@tryverseai.com
          </a>
          .
        </p>
      </section>
    </div>
  );
}

/** Cookie Policy — matches the categories actually offered in CookieConsent.tsx. */
export function CookiePolicyContent(_props: PolicyContentProps = {}) {
  return (
    <div className={prose}>
      <section>
        <h2 className={h2}>1. What Cookies Are</h2>
        <p>
          Cookies are small text files stored on your device. We also use equivalent local-storage entries in your
          browser for the same purposes described below.
        </p>
      </section>
      <section>
        <h2 className={h2}>2. Essential Cookies (Always On)</h2>
        <p>
          Required for the Service to function: keeping you signed in (Convex Auth session), remembering your cookie
          preference, CSRF/security protections, and load-balancing. These cannot be disabled without breaking core
          functionality — declining non-essential cookies never disables these.
        </p>
      </section>
      <section>
        <h2 className={h2}>3. Analytics Cookies (Optional)</h2>
        <p>
          When enabled and where legally required after consent, we use product-analytics tooling to understand
          feature usage, conversion, and reliability — page views, button clicks, and try-on funnel completion. This
          tooling does not receive your uploaded photos. You can decline analytics cookies at any time from the
          cookie banner or the &quot;Cookie Settings&quot; link in the footer.
        </p>
      </section>
      <section>
        <h2 className={h2}>4. Error Monitoring and Security</h2>
        <p>
          Where enabled, error-monitoring tooling captures crash reports and error traces to help us fix bugs and
          investigate security incidents. This is operational, not advertising, tracking, and is not affected by the
          analytics cookie toggle.
        </p>
      </section>
      <section>
        <h2 className={h2}>5. No Third-Party Advertising Cookies</h2>
        <p>
          We do not run advertising or cross-site retargeting cookies, and we do not sell data derived from cookies
          to advertisers, unless this Policy is updated to describe such activity and applicable consent requirements
          are met.
        </p>
      </section>
      <section>
        <h2 className={h2}>6. Managing Your Preference</h2>
        <p>
          Use the &quot;Cookie Settings&quot; link in the footer at any time to change your choice, or clear
          cookies/local storage in your browser to reset it. Blocking essential cookies may prevent sign-in from
          working.
        </p>
      </section>
      <section>
        <h2 className={h2}>7. Changes and Contact</h2>
        <p>
          TryVerse may update this Policy as its technology changes. Questions — use our{" "}
          <Link to="/support" className="text-foreground underline font-medium">
            Contact us
          </Link>{" "}
          page.
        </p>
      </section>
    </div>
  );
}

/** Acceptable Use &amp; Responsible AI/Image Policy — specific to an AI image-generation / virtual try-on product. */
export function AcceptableUsePolicyContent(_props: PolicyContentProps = {}) {
  return (
    <div className={prose}>
      <section>
        <h2 className={h2}>1. Purpose</h2>
        <p>
          TryVerse generates and processes images and videos of real people and synthetic models. This Policy applies
          to everyone who uses TryVerse &mdash; a Customer&rsquo;s team and Authorized Users, and the Shoppers who
          interact with a TryVerse-powered experience on a Customer&rsquo;s storefront &mdash; and exists to protect
          those individuals, the Customers, and the integrity of the platform.
        </p>
      </section>
      <section>
        <h2 className={h2}>2. Consent and Authority for Images</h2>
        <p>
          Only upload a photo of yourself, or of someone else who has given you clear permission or for whom you have
          another lawful basis to process the image. Uploading a photo of another person without their consent —
          including images taken from the internet, a screenshot, or a hidden/candid photo — is prohibited.
        </p>
      </section>
      <section>
        <h2 className={h2}>3. Prohibited Exploitative or Sexual Content</h2>
        <p>
          Do not use TryVerse for sexualized content involving minors, non-consensual intimate imagery, sexual
          exploitation, or other unlawful sexual content.
        </p>
      </section>
      <section>
        <h2 className={h2}>4. Impersonation, Fraud and Deception</h2>
        <p>
          Do not use TryVerse to impersonate a person for fraud, defamation, extortion, harassment, or other unlawful
          deception. Synthetic models must not be represented as real persons where doing so is materially
          misleading.
        </p>
      </section>
      <section>
        <h2 className={h2}>5. Product and Advertising Integrity</h2>
        <p>
          Brands must not intentionally use Generated Content to misrepresent a product&rsquo;s material
          characteristics, fit, color, condition, or performance in a way designed to mislead shoppers. Generated
          imagery should be reviewed before publication.
        </p>
      </section>
      <section>
        <h2 className={h2}>6. Illegal, Harmful or Abusive Content</h2>
        <p>
          Do not use TryVerse for unlawful content, content promoting violence or serious wrongdoing, hate-based
          abuse, threats, harassment, exploitation, or content prohibited by applicable law.
        </p>
      </section>
      <section>
        <h2 className={h2}>7. Security and Platform Abuse</h2>
        <p>
          Do not bypass rate limits, Credits, domain allowlists, or authentication; scrape private information; probe
          other accounts; distribute API keys; reverse-engineer non-public infrastructure; interfere with the
          Service; or introduce malicious code.
        </p>
      </section>
      <section>
        <h2 className={h2}>8. Brand Responsibilities for Shopper Data</h2>
        <p>
          Brands embedding the widget are responsible for having a lawful basis to let their own shoppers upload
          photos through it, and for their own privacy disclosures on their storefront. TryVerse processes that
          shopper data as described in our{" "}
          <Link to="/data-processing" className="text-foreground underline font-medium">
            Data Processing Agreement
          </Link>
          .
        </p>
      </section>
      <section>
        <h2 className={h2}>9. Enforcement</h2>
        <p>
          Violations may result in content removal, restricted features, Credit forfeiture, API key revocation, or
          account suspension or termination, at TryVerse&rsquo;s discretion, with or without notice for serious
          violations. TryVerse may cooperate with authorities where reasonably necessary.
        </p>
      </section>
      <section>
        <h2 className={h2}>10. Reporting Misuse</h2>
        <p>
          If you believe TryVerse is being used to generate or host content that violates this Policy, contact us via{" "}
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
 * AI & Image Processing Notice — customer-facing notice for photo, likeness, synthetic-model
 * and generation risks. Shown standalone at /ai-image-notice and as a step in business
 * onboarding (ComplianceOnboardingModal; previously a separate, narrower "Personal Data Notice").
 */
export function AiImageProcessingNoticeContent(_props: PolicyContentProps = {}) {
  return (
    <div className={prose}>
      <section>
        <h2 className={h2}>1. What TryVerse Does</h2>
        <p>
          TryVerse uses automated AI systems to transform or generate fashion-related images and videos. Features may
          include virtual Try-On, Complete Outfit, AI Model Studio, AI Photoshoot, Product Photography, and AI Video.
        </p>
      </section>
      <section>
        <h2 className={h2}>2. Real-Person Images</h2>
        <p>
          Where you submit a photograph of a real person, TryVerse processes the visual information needed to
          perform the requested generation. You are responsible for having the necessary permission or lawful basis
          — see our{" "}
          <Link to="/acceptable-use" className="text-foreground underline font-medium">
            Acceptable Use Policy
          </Link>
          .
        </p>
      </section>
      <section>
        <h2 className={h2}>3. Likeness and Accuracy</h2>
        <p>
          AI systems may alter facial features, body proportions, products (clothing, footwear, eyewear, jewelry),
          backgrounds, lighting, pose, or other visual details. Try-On is a visualization rather than a guarantee of
          actual fit or appearance.
        </p>
      </section>
      <section>
        <h2 className={h2}>4. Synthetic Models</h2>
        <p>
          Generated models may be entirely synthetic. A generated model is not necessarily a real person and should
          not be represented as such where doing so would mislead.
        </p>
      </section>
      <section>
        <h2 className={h2}>5. Product Photography and Photoshoots</h2>
        <p>
          AI-generated product imagery may contain inaccuracies. Brands should compare outputs against the actual
          product and review them before commercial publication.
        </p>
      </section>
      <section>
        <h2 className={h2}>6. Human Review</h2>
        <p>
          Generated outputs are produced automatically and are not generally reviewed by a human before delivery. You
          are responsible for reviewing outputs before relying on them.
        </p>
      </section>
      <section>
        <h2 className={h2}>7. How This Fits With Our Other Policies</h2>
        <p>
          TryVerse&rsquo;s ordinary product experience is designed around TryVerse capabilities rather than requiring
          you to understand the underlying AI infrastructure. What we collect and retain is described in the{" "}
          <Link to="/privacy" className="text-foreground underline font-medium">
            Privacy Policy
          </Link>
          ; required legal disclosures about our subprocessors are maintained separately and made available to
          business customers on request.
        </p>
      </section>
    </div>
  );
}
