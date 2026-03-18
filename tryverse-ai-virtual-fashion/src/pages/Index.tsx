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
        <title>TryVerse AI — Virtual Try-On for Fashion & Jewelry</title>
        <meta name="description" content="AI-powered virtual try-on platform for fashion and jewelry brands. Let shoppers see how clothes and accessories look on them before buying. Boost conversions by 3x." />
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
