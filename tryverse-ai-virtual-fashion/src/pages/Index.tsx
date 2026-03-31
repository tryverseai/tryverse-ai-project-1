import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { TrustedBy } from "@/components/TrustedBy";
import { HowItWorks } from "@/components/HowItWorks";
import { JewelryShowcase } from "@/components/JewelryShowcase";
import { FeaturesSection } from "@/components/FeaturesSection";
import { TechnologySection } from "@/components/TechnologySection";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>TryVerse AI — Virtual Try-On for Brands & Shoppers</title>
        <meta
          name="description"
          content="AI virtual try-on and fit intelligence for fashion brands (widget, API, dashboard) and for people who want a personal try-on studio. Reduce returns, lift conversions, try outfits at home."
        />
        <link rel="canonical" href="https://tryverse.ai/" />
      </Helmet>
      <Navbar />
      <HeroSection />
      <TrustedBy />
      <HowItWorks />
      <JewelryShowcase />
      <FeaturesSection />
      <TechnologySection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
