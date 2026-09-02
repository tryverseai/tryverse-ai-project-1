import { Navbar } from "@/components/Navbar";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { HeroSection } from "@/components/landing/HeroSection";
import { ConfidenceSection } from "@/components/landing/ConfidenceSection";
import { MannequinSection } from "@/components/landing/MannequinSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { PlatformSection } from "@/components/landing/PlatformSection";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";
import { MotionConfig } from "framer-motion";


const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>TryVerse AI — AI Infrastructure for Fashion Commerce</title>
        <meta
          name="description"
          content="AI infrastructure for the future of fashion commerce. TryVerse powers virtual try-on, AI models, product photography, AI photoshoots, and fashion video from a single platform, embedded directly in your storefront."
        />
        <link rel="canonical" href="https://tryverseai.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="TryVerse AI — AI Infrastructure for Fashion Commerce" />
        <meta
          property="og:description"
          content="Virtual try-on, AI models, product photography, and fashion video — from a single AI fashion infrastructure platform."
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
          <CTASection />
        </main>

        <Footer />
      </MotionConfig>
    </div>
  );
};

export default Index;
