import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const TermsOfService = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-[var(--navbar-height)] pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: March 9, 2026</p>

          <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
            <section>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p>By accessing or using TryVerse ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
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
              <p>TryVerse is provided "as is" without warranties. We are not liable for indirect, incidental, or consequential damages arising from your use of the Service.</p>
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
        </motion.div>
      </div>
    </main>
    <Footer />
  </div>
);

export default TermsOfService;
