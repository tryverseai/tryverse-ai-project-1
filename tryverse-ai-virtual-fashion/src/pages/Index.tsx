import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { TrustedBy } from "@/components/TrustedBy";
import { HowItWorks } from "@/components/HowItWorks";
import { FeaturesSection } from "@/components/FeaturesSection";
import { TechnologySection } from "@/components/TechnologySection";
import { JewelryShowcase } from "@/components/JewelryShowcase";
import { CTASection } from "@/components/CTASection";
import { Footer } from "@/components/Footer";
import { Helmet } from "react-helmet-async";

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
      <Navbar />
      <HeroSection />
      <TrustedBy />
      <HowItWorks />
      <FeaturesSection />
      <TechnologySection />
      <JewelryShowcase />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
