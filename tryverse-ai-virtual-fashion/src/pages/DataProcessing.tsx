import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";

const DataProcessing = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-[var(--navbar-height)] pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">Data Processing Agreement</h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: March 9, 2026</p>

          <div className="prose prose-neutral max-w-none space-y-8 text-foreground/90 text-sm leading-relaxed">
            <section>
              <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Scope</h2>
              <p>This Data Processing Agreement ("DPA") applies to the processing of personal data by TryVerse on behalf of brands ("Data Controllers") who use our virtual try-on service.</p>
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
              <p>For DPA inquiries, contact <a href="mailto:dpa@tryverse.ai" className="text-foreground underline">dpa@tryverse.ai</a>.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </main>
    <Footer />
  </div>
);

export default DataProcessing;
