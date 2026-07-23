import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { TryVersePrivacyPolicy } from "@/content/TryVersePrivacyPolicy";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <main className="pt-[var(--navbar-height)] pb-20">
      <div className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-foreground"
        >
          <TryVersePrivacyPolicy />
        </motion.div>
      </div>
    </main>
    <Footer />
  </div>
);

export default PrivacyPolicy;
