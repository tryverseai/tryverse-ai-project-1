import { Navbar } from "@/components/Navbar";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { HeroSection } from "@/components/landing/HeroSection";
import { ConfidenceSection } from "@/components/landing/ConfidenceSection";
import { MannequinSection } from "@/components/landing/MannequinSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { PlatformSection } from "@/components/landing/PlatformSection";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";
import { MotionConfig } from "framer-motion";


const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>TryVerse AI — Infrastructure for Fashion Visualization</title>
        <meta
          name="description"
          content="AI infrastructure for fashion visualization. Virtual try-on, AI fashion photography, AI model generation, and outfit visualization for online fashion commerce — through APIs and SDKs."
        />
        <link rel="canonical" href="https://tryverseai.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="TryVerse AI — Infrastructure for Fashion Visualization" />
        <meta
          property="og:description"
          content="Virtual try-on, AI fashion photography, and outfit visualization — from a single fashion visualization platform."
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Global reduced-motion guard for every framer-motion animation in this subtree. */}
      <MotionConfig reducedMotion="user">
        <SmoothScroll />
        <ScrollProgress />
        <Navbar />
        <main id="main">
          <HeroSection />
          <ConfidenceSection />
          <MannequinSection />
          <HowItWorksSection />
          <PlatformSection />
        </main>

        <Footer />
      </MotionConfig>
    </div>
  );
};

export default Index;
