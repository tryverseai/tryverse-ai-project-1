import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { PolicyAudience } from "@/content/policyContent";

/**
 * Official TryVerse Privacy Policy.
 */
export function TryVersePrivacyPolicy({
  className,
  audience: _audience,
}: {
  className?: string;
  audience?: PolicyAudience;
}) {
  return (
    <article
      className={cn(
        "tryverse-privacy-policy text-foreground max-w-none space-y-10 text-[15px] leading-relaxed",
        "[&_h2]:scroll-mt-24 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1",
        className,
      )}
    >
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last Updated: August 24, 2026</p>
      </header>

      <Alert className="not-prose border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-200">
        <Info className="h-4 w-4" />
        <AlertDescription>
          This Policy is drafted and in effect, but our registered legal entity details and the exact list of
          international transfer countries are still pending final confirmation with legal counsel and will be
          updated once resolved.
        </AlertDescription>
      </Alert>

      <p>
        Welcome to TryVerse. This Privacy Policy explains how TryVerse AI (&quot;TryVerse,&quot; &quot;we,&quot;
        &quot;our,&quot; or &quot;us&quot;) collects, uses, stores, and protects your information when you use our
        website, applications, AI fashion-visualization tools, embeddable storefront widget, developer API/SDK, and
        related services (collectively, the &quot;Services&quot;).
      </p>
      <p>
        It applies to individuals using TryVerse directly and describes the relevant processing in brand/merchant
        contexts. Where TryVerse processes shopper data strictly on a brand&rsquo;s documented instructions, the
        brand is the controller and TryVerse acts as processor under our{" "}
        <Link to="/data-processing" className="text-primary underline underline-offset-2 font-medium">
          Data Processing Agreement
        </Link>
        . By accessing or using TryVerse, you agree to the practices described in this Privacy Policy.
      </p>

      <hr className="border-border" />

      <section>
        <h2>1. Who We Are</h2>
        <p>
          TryVerse is an AI infrastructure platform for fashion visualization, operated by TryVerse AI. Brands
          connect their product catalogue and embed our widget, call our API, or use our dashboard tools to generate
          virtual try-ons, complete-outfit visualizations, AI fashion models, product photoshoots, and short product
          videos — rendered onto a photo of a shopper (or a preset/generated model) before they buy. Individuals can
          also use TryVerse directly through our web app (Personal Studio) to try on outfits for themselves.
        </p>
        <p>Our Services include:</p>
        <ul>
          <li>AI virtual try-on and complete-outfit generation</li>
          <li>AI Model Studio and AI Model Generation, AI Photoshoot, and Product Photography — generated or catalogue-based fashion models and imagery</li>
          <li>AI Video — short product/try-on video generation</li>
          <li>An embeddable storefront widget and personalization script for e-commerce sites</li>
          <li>A developer API, SDK, and API keys for programmatic try-on and content-generation requests</li>
          <li>A merchant dashboard with product management, analytics, and billing</li>
          <li>Waitlist, early-access, and invite-based onboarding</li>
        </ul>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p>
          We collect information you provide directly to us, information generated through your use of the Services,
          and limited technical information collected automatically.
        </p>
        <h3>Account Information</h3>
        <ul>
          <li>Name and email address</li>
          <li>Password (stored as a salted hash — we never store or can read your plaintext password)</li>
          <li>Account type (individual or business), brand or company name, and role/job title</li>
        </ul>
        <h3>Photos and Product Images</h3>
        <ul>
          <li>Shopper/user photos — the photo you (or a shopper interacting with a brand&rsquo;s widget) upload as the &quot;person&quot; image for a try-on</li>
          <li>Brand product images uploaded to a product catalogue to generate try-on results against</li>
          <li>The AI-generated try-on images produced from the above</li>
        </ul>
        <h3>Account &amp; Billing Information</h3>
        <p>
          For paid plans, our payment processors (see &quot;Payments&quot; below) collect and process your billing
          details directly. TryVerse does not store full card numbers or complete payment credentials on our own
          servers — we retain only plan, transaction, and invoice metadata needed for billing and support.
        </p>
        <h3>Communications</h3>
        <p>
          If you contact support, join our waitlist, book a demo, or respond to a survey, we may collect messages,
          feedback, support requests, and business inquiry information (company name, website, monthly volume, etc.).
        </p>
      </section>

      <section>
        <h2>3. Information Collected Automatically</h2>
        <p>
          When you use TryVerse, we may automatically collect limited technical information including IP address,
          browser type, device information, and operating system; usage activity within the dashboard and widget
          (e.g. try-on counts, feature usage); error logs and crash reports; and session and authentication
          information. Where enabled, product-analytics and error-monitoring tools (see &quot;Analytics &amp; Error
          Monitoring&quot; below) collect a subset of this information to help us keep the Services secure and
          reliable.
        </p>
      </section>

      <section>
        <h2>4. How We Use Your Information</h2>
        <p>We use your information to operate, improve, and secure TryVerse. This includes:</p>
        <ul>
          <li>creating and managing accounts and API keys</li>
          <li>generating AI virtual try-on results from the photos and product images you or a shopper submit</li>
          <li>processing payments and managing subscriptions</li>
          <li>sending account, security, and transactional emails (verification codes, receipts, device-approval codes)</li>
          <li>providing customer support</li>
          <li>monitoring platform performance, debugging errors, and preventing abuse</li>
          <li>complying with legal obligations</li>
        </ul>
        <p>
          We do not use uploaded photos to train foundation AI models, and we do not use your try-on photos for our
          own marketing without your permission.
        </p>
      </section>

      <section>
        <h2>5. AI &amp; Image Processing</h2>
        <p>
          When you or a shopper submit a photo and a product image, TryVerse routes them through an AI try-on
          pipeline that composites the product onto the person image — clothing, footwear, eyewear, and jewelry are
          all supported categories. Depending on the category and configuration, this may include automated
          pre-processing (e.g. framing, background handling) and post-processing of the generated result.
        </p>
        <p>
          AI-generated results are produced automatically and are not reviewed by a human before being returned. We
          aim to preserve the shopper&rsquo;s likeness and the product&rsquo;s appearance, but outputs are not
          guaranteed to be a perfectly accurate representation of how a product will look or fit in real life. See
          our{" "}
          <Link to="/ai-image-notice" className="text-primary underline underline-offset-2 font-medium">
            AI &amp; Image Processing Notice
          </Link>{" "}
          for more detail.
        </p>
      </section>

      <section>
        <h2>6. Third-Party AI Providers</h2>
        <p>
          Try-on generation is powered by third-party AI infrastructure providers who process image inputs solely to
          return the requested output. Our ordinary product experience is designed around TryVerse capabilities
          rather than naming the underlying AI provider or model — that infrastructure is treated as an internal
          implementation detail, and we may add, remove, or change providers as our technology evolves. These
          providers receive only the image data required to generate a specific result and process it under their
          own data-processing terms; we do not permit them to use TryVerse image submissions to train their
          general-purpose models. A current list of subprocessors, including our AI infrastructure provider, is
          available to business customers on request.
        </p>
      </section>

      <section>
        <h2>7. Where We Store Your Data</h2>
        <p>
          TryVerse stores account records, product catalogue data, try-on history, and uploaded/generated images
          using Convex as our primary database and file-storage provider. Convex encrypts data in transit
          (HTTPS/TLS) and provides access-controlled, managed cloud storage for uploaded and generated images.
        </p>
        <h3>Reference Photo Retention (Widget Personalization)</h3>
        <p>
          For the storefront personalization widget, shopper reference photos are stored server-side for AI
          processing and automatically deleted after 7 days. Widget sessions are anonymous — no shopper account is
          required, and we do not link the reference photo to a persistent shopper identity beyond that session
          window.
        </p>
        <p>
          For dashboard-based try-ons (signed-in individual or business accounts), person and product images and the
          resulting try-on outputs are retained as part of your try-on history until you delete them or close your
          account, so you can revisit past results.
        </p>
      </section>

      <section>
        <h2>8. Cookies, Local Storage &amp; Analytics</h2>
        <p>
          We use essential cookies and browser local storage to keep you signed in, remember your cookie-consent
          choice, and support core functionality like the signup and try-on flows. Where you consent, we also use
          analytics cookies. Full detail on what we set and why is in our{" "}
          <Link to="/cookie-policy" className="text-primary underline underline-offset-2 font-medium">
            Cookie Policy
          </Link>
          .
        </p>
        <h3>Analytics &amp; Error Monitoring</h3>
        <p>
          Where configured, we use product-analytics tooling for aggregate usage insight (e.g. sign-ups, try-on
          completions) and error-monitoring tooling to catch crashes. Both are optional and only active when the
          corresponding environment configuration is set for a given deployment. We do not enable session-replay
          recording, and our error reports strip authorization/auth-token headers before they are sent. You can opt
          out of non-essential analytics cookies via the cookie banner or your cookie preferences.
        </p>
      </section>

      <section>
        <h2>9. How We Share Information</h2>
        <p>We do not sell personal information. We share limited information only as needed to run the Services:</p>
        <ul>
          <li>Payment processors — Paystack and Flutterwave, to process subscription payments in NGN and USD</li>
          <li>AI infrastructure providers, to generate try-on and personalization results (see &quot;Third-Party AI Providers&quot; above)</li>
          <li>Hosting &amp; storage — Convex (database and file storage) and our application hosting providers</li>
          <li>Email delivery — Resend, to send transactional email (verification codes, password resets, receipts, welcome and device-approval emails)</li>
          <li>Analytics &amp; monitoring — PostHog and Sentry, where enabled</li>
          <li>Legal authorities, where required by law or to protect the rights, safety, or property of TryVerse or others</li>
        </ul>
        <p>
          For business (brand) accounts, shopper photos submitted through your widget or API integration are
          processed on your behalf as described in our{" "}
          <Link to="/data-processing" className="text-primary underline underline-offset-2 font-medium">
            Data Processing Agreement
          </Link>
          . If TryVerse undergoes a merger, acquisition, or sale, user information may be transferred as part of
          that transaction, subject to this Privacy Policy.
        </p>
      </section>

      <section>
        <h2>10. Data Storage &amp; Security</h2>
        <p>
          We use reasonable technical and organizational safeguards designed to protect your information, including
          encrypted connections (HTTPS/TLS) for all data in transit; hashed passwords and scoped API keys; role-based
          access controls and authenticated sessions; and managed, access-controlled cloud storage (Convex) for
          uploaded and generated images. However, no online service can guarantee absolute security. You are
          responsible for keeping your login credentials and API keys confidential.
        </p>
      </section>

      <section>
        <h2>11. Data Retention</h2>
        <p>
          We retain information only for as long as reasonably necessary to provide the Services, comply with legal
          obligations, resolve disputes, and enforce our agreements. In particular: widget/personalization reference
          photos are auto-deleted after 7 days (see &quot;Where We Store Your Data&quot;); dashboard try-on history
          is retained until you delete individual try-ons or close your account; and account and billing records are
          retained while your account is active and for a limited period afterward as required for accounting, tax,
          and legal purposes. You may request deletion of your account and associated data at any time (see
          &quot;Your Rights&quot; below).
        </p>
      </section>

      <section>
        <h2>12. Your Rights</h2>
        <p>
          Depending on your location, you may have rights including access to your data, correction of inaccurate
          information, deletion of your account and associated data, restriction of or objection to certain
          processing, withdrawal of consent (e.g. for analytics cookies), and data portability. You may request
          account deletion or data access by contacting{" "}
          <a className="text-primary underline underline-offset-2 font-medium" href="mailto:info@tryverseai.com">
            info@tryverseai.com
          </a>
          . We will respond in accordance with applicable laws.
        </p>
      </section>

      <section>
        <h2>13. Children&rsquo;s Privacy</h2>
        <p>
          TryVerse is not intended for children under the age of 13. Users under 18 should use the Services only
          with appropriate parental or guardian permission where required by local law. We do not knowingly collect
          personal information from children in violation of applicable laws.
        </p>
      </section>

      <section>
        <h2>14. International Users</h2>
        <p>
          TryVerse may process and store information in multiple countries depending on our infrastructure providers
          and operations — currently including the European Union, where our primary database provider hosts data,
          and other countries where our hosting, payment, email, analytics, and monitoring providers operate. By
          using our Services, you understand that your information may be transferred to countries outside your
          place of residence. A complete country-by-country breakdown is being finalized with counsel.
        </p>
      </section>

      <section>
        <h2>15. Waitlist &amp; Early Access</h2>
        <p>
          TryVerse may operate invite-only, beta, or waitlist-based access programs. Information submitted through
          waitlists, demo requests, partnership forms, and onboarding applications may be used to evaluate
          eligibility, contact applicants, prioritize onboarding, and improve launch planning. Submitting a waitlist
          application does not guarantee access.
        </p>
      </section>

      <section>
        <h2>16. Marketing Communications</h2>
        <p>
          We may send product updates, onboarding emails, platform announcements, and promotional communications.
          You may unsubscribe from marketing emails at any time using the unsubscribe link provided in the email.
          Service-related transactional emails (verification codes, receipts, security notices) may still be sent
          when necessary.
        </p>
      </section>

      <section>
        <h2>17. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy periodically. If material changes are made, we may notify users through
          email, platform notifications, or updates on our website. Continued use of the Services after updates
          means you accept the revised policy.
        </p>
      </section>

      <section>
        <h2>18. Contact Us</h2>
        <p>If you have questions about this Privacy Policy or your data, contact us at:</p>
        <p>
          Email:{" "}
          <a className="text-primary underline underline-offset-2 font-medium" href="mailto:info@tryverseai.com">
            info@tryverseai.com
          </a>
        </p>
      </section>
    </article>
  );
}
