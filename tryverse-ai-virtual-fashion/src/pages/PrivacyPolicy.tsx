import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-28 pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: March 9, 2026</p>

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
              <p>For privacy inquiries, contact our Data Protection Officer at <a href="mailto:privacy@tryverse.ai" className="text-foreground underline">privacy@tryverse.ai</a>.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </main>
    <Footer />
  </div>
);

export default PrivacyPolicy;
