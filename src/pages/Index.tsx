import { Navbar } from "@/components/Navbar";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { ConfidenceSection } from "@/components/landing/ConfidenceSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { TryOnProofSection } from "@/components/landing/TryOnProofSection";
import { CampaignGallerySection } from "@/components/landing/CampaignGallerySection";
import { MannequinSection } from "@/components/landing/MannequinSection";
import { PlatformSection } from "@/components/landing/PlatformSection";
import { IntegrationSection } from "@/components/landing/IntegrationSection";
import { BenefitsSection } from "@/components/landing/BenefitsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ClosingSection } from "@/components/landing/ClosingSection";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";
import { MotionConfig } from "framer-motion";


const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>TryVerse AI — Virtual Try-On for Fashion Brands</title>
        <meta
          name="description"
          content="AI virtual try-on infrastructure for fashion brands. Let shoppers see garments on their own body before they buy — embedded in your storefront or called through the API."
        />
        <link rel="canonical" href="https://tryverseai.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="TryVerse AI — Virtual Try-On for Fashion Brands" />
        <meta
          property="og:description"
          content="AI virtual try-on infrastructure for fashion brands. Shoppers see the garment on themselves before they commit."
        />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Global reduced-motion guard for every framer-motion animation in this subtree. */}
      <MotionConfig reducedMotion="user">
        <SmoothScroll />
        <ScrollProgress />
        <Navbar />
        <main id="main">
          <ClosingSection />
          <HeroSection />
          <ProblemSection />
          <ConfidenceSection />
          <HowItWorksSection />
          <TryOnProofSection />
          <CampaignGallerySection />
          <MannequinSection />
          <PlatformSection />
          <IntegrationSection />
          <BenefitsSection />
          <PricingSection />

        </main>

        <Footer />
      </MotionConfig>
    </div>
  );
};

export default Index;
