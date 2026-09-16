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
import { MotionConfig } from "framer-motion";
import { Seo } from "@/components/Seo";


const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo path="/" />

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
