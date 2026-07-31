import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { TrustedBy } from "@/components/TrustedBy";
import { HowItWorks } from "@/components/HowItWorks";
import { FeaturesSection } from "@/components/FeaturesSection";
import { TechnologySection } from "@/components/TechnologySection";
import { CTASection } from "@/components/CTASection";
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
          content="B2B AI virtual try-on for fashion brands and e-commerce retailers. Embed try-on on your product pages, reduce returns, and increase conversions."
        />
        <link rel="canonical" href="https://tryverseai.com/" />
      </Helmet>
      {/* Global reduced-motion guard: shrinks every framer-motion animation in this subtree to
          near-instant when the OS/browser "prefers-reduced-motion" setting is on. */}
      <MotionConfig reducedMotion="user">
        <Navbar />
        <HeroSection />
        <TrustedBy />
        <HowItWorks />
        <FeaturesSection />
        <TechnologySection />
        <CTASection />
        <Footer />
      </MotionConfig>
    </div>
  );
};

export default Index;
