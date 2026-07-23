import { cn } from "@/lib/utils";
import type { PolicyAudience } from "@/content/policyContent";

/**
 * Official TryVerse Privacy Policy (replaces embedded Termly HTML).
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
        <p className="text-sm text-muted-foreground">Last Updated: May 2026</p>
      </header>

      <p>
        Welcome to TryVerse. This Privacy Policy explains how TryVerse AI (&quot;TryVerse,&quot; &quot;we,&quot;
        &quot;our,&quot; or &quot;us&quot;) collects, uses, stores, and protects your information when you use our
        website, applications, AI virtual try-on tools, and related services (collectively, the &quot;Services&quot;).
      </p>
      <p>By accessing or using TryVerse, you agree to the practices described in this Privacy Policy.</p>

      <hr className="border-border" />

      <section>
        <h2>1. Who We Are</h2>
        <p>
          TryVerse is an AI-powered virtual fashion platform that enables users and brands to visualize clothing on
          realistic human models through artificial intelligence and image generation technologies.
        </p>
        <p>Our Services may include:</p>
        <ul>
          <li>AI virtual try-on experiences</li>
          <li>Product-to-model visualization</li>
          <li>AI-generated fashion imagery</li>
          <li>Brand and creator tools</li>
          <li>Waitlist and early-access programs</li>
          <li>Fashion commerce integrations</li>
        </ul>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p>
          We collect information you provide directly to us, information generated through your use of our Services,
          and limited technical information collected automatically.
        </p>
        <h3>Information You Provide</h3>
        <p>Depending on how you use TryVerse, we may collect:</p>
        <h3>Account Information</h3>
        <ul>
          <li>Name</li>
          <li>Email address</li>
          <li>Username</li>
          <li>Password</li>
          <li>Account type (individual or business)</li>
          <li>Company or brand name</li>
          <li>Role or job title</li>
        </ul>
        <h3>Uploaded Content</h3>
        <ul>
          <li>Photos you upload</li>
          <li>Clothing images</li>
          <li>Product assets</li>
          <li>AI generation inputs</li>
          <li>Reference images</li>
        </ul>
        <h3>Body &amp; Fit Information</h3>
        <p>To improve virtual try-on accuracy, users may optionally provide:</p>
        <ul>
          <li>Clothing sizes</li>
          <li>Body measurements</li>
          <li>Fit preferences</li>
        </ul>
        <p>We treat this information as sensitive personal information where required by law.</p>
        <h3>Payment Information</h3>
        <p>Payments are processed securely through third-party payment providers such as:</p>
        <ul>
          <li>Paystack</li>
          <li>Flutterwave</li>
        </ul>
        <p>TryVerse does not store full card numbers or complete payment credentials on our servers.</p>
        <h3>Communications</h3>
        <p>If you contact us, join our waitlist, book a demo, or respond to surveys, we may collect:</p>
        <ul>
          <li>Messages</li>
          <li>Feedback</li>
          <li>Support requests</li>
          <li>Business inquiry information</li>
        </ul>
      </section>

      <section>
        <h2>3. Information Collected Automatically</h2>
        <p>When you use TryVerse, we may automatically collect limited technical information including:</p>
        <ul>
          <li>IP address</li>
          <li>Browser type</li>
          <li>Device information</li>
          <li>Operating system</li>
          <li>Usage activity</li>
          <li>Error logs</li>
          <li>Session information</li>
          <li>Analytics data</li>
        </ul>
        <p>This information helps us:</p>
        <ul>
          <li>maintain platform security</li>
          <li>improve performance</li>
          <li>detect abuse or fraud</li>
          <li>understand product usage</li>
        </ul>
      </section>

      <section>
        <h2>4. How We Use Your Information</h2>
        <p>We use your information to operate, improve, and secure TryVerse.</p>
        <p>This may include:</p>
        <ul>
          <li>creating and managing accounts</li>
          <li>providing AI virtual try-on services</li>
          <li>processing uploaded images</li>
          <li>generating AI fashion outputs</li>
          <li>processing payments</li>
          <li>sending account or security notifications</li>
          <li>providing customer support</li>
          <li>improving AI performance</li>
          <li>analyzing platform usage</li>
          <li>preventing fraud or abuse</li>
          <li>complying with legal obligations</li>
        </ul>
        <p>We may also use anonymized or aggregated data to improve our AI systems and platform performance.</p>
      </section>

      <section>
        <h2>5. AI &amp; Image Processing</h2>
        <p>TryVerse uses artificial intelligence and machine learning systems to generate virtual try-on results and fashion visualizations.</p>
        <p>When you upload photos or images:</p>
        <ul>
          <li>the images may be processed by AI systems</li>
          <li>outputs may be generated automatically</li>
          <li>uploaded images may be temporarily stored for processing</li>
          <li>AI-generated results may vary in accuracy</li>
        </ul>
        <p>
          We aim to preserve identity consistency and visual realism, but AI-generated outputs are not guaranteed to be
          perfectly accurate representations.
        </p>
        <p>We do not use uploaded user photos for public marketing without permission.</p>
      </section>

      <section>
        <h2>6. Third-Party AI Providers</h2>
        <p>Some AI processing may be powered by trusted third-party infrastructure providers or APIs.</p>
        <p>These providers may temporarily process image inputs solely for the purpose of generating requested outputs.</p>
        <p>Examples may include:</p>
        <ul>
          <li>Replicate</li>
          <li>FASHN AI</li>
          <li>cloud infrastructure and GPU providers</li>
        </ul>
        <p>We work to ensure partners maintain appropriate security and confidentiality standards.</p>
      </section>

      <section>
        <h2>7. Cookies &amp; Analytics</h2>
        <p>We may use cookies and similar technologies to:</p>
        <ul>
          <li>keep users signed in</li>
          <li>remember preferences</li>
          <li>analyze traffic and usage</li>
          <li>improve platform functionality</li>
          <li>measure marketing performance</li>
        </ul>
        <p>You may disable cookies in your browser settings, though parts of the Services may not function properly.</p>
      </section>

      <section>
        <h2>8. How We Share Information</h2>
        <p>We do not sell personal information.</p>
        <p>We may share limited information with:</p>
        <ul>
          <li>payment processors</li>
          <li>infrastructure providers</li>
          <li>analytics providers</li>
          <li>customer support tools</li>
          <li>legal authorities when required by law</li>
        </ul>
        <p>We may also disclose information:</p>
        <ul>
          <li>to protect platform security</li>
          <li>prevent fraud or abuse</li>
          <li>enforce our Terms</li>
          <li>comply with legal obligations</li>
        </ul>
        <p>If TryVerse undergoes a merger, acquisition, or sale, user information may be transferred as part of that transaction.</p>
      </section>

      <section>
        <h2>9. Data Storage &amp; Security</h2>
        <p>We use reasonable technical and organizational safeguards designed to protect your information.</p>
        <p>These may include:</p>
        <ul>
          <li>encrypted connections (HTTPS)</li>
          <li>access controls</li>
          <li>authentication systems</li>
          <li>infrastructure monitoring</li>
          <li>secure cloud storage</li>
          <li>restricted administrative access</li>
        </ul>
        <p>However, no online service can guarantee absolute security.</p>
        <p>Users are responsible for maintaining the confidentiality of their login credentials.</p>
      </section>

      <section>
        <h2>10. Data Retention</h2>
        <p>We retain information only for as long as reasonably necessary to:</p>
        <ul>
          <li>provide our Services</li>
          <li>comply with legal obligations</li>
          <li>resolve disputes</li>
          <li>enforce agreements</li>
          <li>improve platform operations</li>
        </ul>
        <p>Uploaded images and AI outputs may be deleted periodically based on operational and storage requirements.</p>
        <p>We may retain certain records where legally required.</p>
      </section>

      <section>
        <h2>11. Your Rights</h2>
        <p>Depending on your location, you may have rights including:</p>
        <ul>
          <li>access to your data</li>
          <li>correction of inaccurate information</li>
          <li>deletion requests</li>
          <li>restriction of processing</li>
          <li>withdrawal of consent</li>
          <li>data portability</li>
          <li>objection to certain processing activities</li>
        </ul>
        <p>
          You may request account deletion or data access by contacting:{" "}
          <a className="text-primary underline underline-offset-2 font-medium" href="mailto:info@tryverseai.com">
            info@tryverseai.com
          </a>
          .
        </p>
        <p>We will respond in accordance with applicable laws.</p>
      </section>

      <section>
        <h2>12. Children&apos;s Privacy</h2>
        <p>TryVerse is not intended for children under the age of 13.</p>
        <p>Users under 18 should use the Services only with appropriate parental or guardian permission where required by local law.</p>
        <p>We do not knowingly collect personal information from children in violation of applicable laws.</p>
      </section>

      <section>
        <h2>13. International Users</h2>
        <p>TryVerse may process and store information in multiple countries depending on our infrastructure providers and operations.</p>
        <p>By using our Services, you understand that your information may be transferred to countries outside your place of residence.</p>
      </section>

      <section>
        <h2>14. Waitlist &amp; Early Access</h2>
        <p>TryVerse may operate invite-only, beta, or waitlist-based access programs.</p>
        <p>Information submitted through:</p>
        <ul>
          <li>waitlists</li>
          <li>demo requests</li>
          <li>partnership forms</li>
          <li>onboarding applications</li>
        </ul>
        <p>may be used to:</p>
        <ul>
          <li>evaluate eligibility</li>
          <li>contact applicants</li>
          <li>prioritize onboarding</li>
          <li>improve launch planning</li>
        </ul>
        <p>Submitting a waitlist application does not guarantee access.</p>
      </section>

      <section>
        <h2>15. Marketing Communications</h2>
        <p>We may send:</p>
        <ul>
          <li>product updates</li>
          <li>onboarding emails</li>
          <li>platform announcements</li>
          <li>promotional communications</li>
        </ul>
        <p>You may unsubscribe from marketing emails at any time using the unsubscribe link provided in the email.</p>
        <p>Service-related emails may still be sent when necessary.</p>
      </section>

      <section>
        <h2>16. Changes to This Policy</h2>
        <p>We may update this Privacy Policy periodically.</p>
        <p>If material changes are made, we may notify users through:</p>
        <ul>
          <li>email</li>
          <li>platform notifications</li>
          <li>updates on our website</li>
        </ul>
        <p>Continued use of the Services after updates means you accept the revised policy.</p>
      </section>

      <section>
        <h2>17. Contact Us</h2>
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
