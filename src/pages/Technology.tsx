import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CTASection } from "@/components/CTASection";
import { TechnologySection } from "@/components/TechnologySection";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

const Technology = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Technology — TryVerse AI Infrastructure for Fashion Visualization</title>
        <meta
          name="description"
          content="The infrastructure behind fashion visualization — how TryVerse powers virtual try-on, AI-generated content, and commerce integration across storefronts, marketplaces, and applications."
        />
        <link rel="canonical" href="https://tryverseai.com/technology" />
      </Helmet>
      <Navbar />
      <main className="pt-[var(--navbar-height)] pb-0">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12 sm:mb-16 md:mb-20 max-w-3xl mx-auto pt-12 sm:pt-16"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Technology</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              The Infrastructure Behind Fashion Visualization
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              TryVerse provides the infrastructure brands need to bring richer, more interactive product experiences
              to digital fashion commerce. From visualization and virtual try-on to AI-powered fashion content, our
              platform is designed to power these experiences across the places where customers shop — from
              storefronts and marketplaces to applications and commerce platforms.
            </p>
          </motion.div>
        </div>

        <TechnologySection />

        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Technology;
