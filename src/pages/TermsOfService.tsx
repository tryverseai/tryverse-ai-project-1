import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { TermsContent } from "@/content/policyContent";

const TermsOfService = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-[var(--navbar-height)] pb-20">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">
            These are the terms for TryVerse business accounts.
          </p>
          <p className="text-sm text-muted-foreground mb-12">Last updated: August 24, 2026</p>
          <TermsContent audience="business" />
        </motion.div>
      </div>
    </main>
    <Footer />
  </div>
);

export default TermsOfService;
