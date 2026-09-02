import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CTASection } from "@/components/CTASection";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GLASS_EASE, glassOuter, glassInner, glassInnerCard } from "@/lib/glassFrame";
import { Eye, Layers, Feather, Globe, ShieldCheck } from "lucide-react";
import { Helmet } from "react-helmet-async";

const values = [
  {
    icon: Eye,
    title: "Visualization",
    description: "We believe shoppers should be able to experience products — not simply look at them.",
  },
  {
    icon: Layers,
    title: "Infrastructure",
    description: "We're building a platform, not a single feature. TryVerse is designed to support an expanding ecosystem of AI-powered fashion experiences.",
  },
  {
    icon: Feather,
    title: "Simplicity",
    description: "Complex technology should create simple experiences. Brands should be able to integrate powerful capabilities without rebuilding their commerce stack.",
  },
  {
    icon: Globe,
    title: "Scale",
    description: "Fashion is global. Our infrastructure is designed to support brands as they grow, expand their catalogs, and serve more customers.",
  },
  {
    icon: ShieldCheck,
    title: "Confidence",
    description: "Better visualization leads to better-informed decisions. We're building technology that helps close the gap between seeing a product online and knowing what it could feel like to own it.",
  },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>About — TryVerse AI Infrastructure for Fashion Visualization</title>
        <meta
          name="description"
          content="TryVerse builds AI infrastructure for fashion visualization — virtual try-on, AI model photography, and outfit visualization for online fashion commerce."
        />
        <link rel="canonical" href="https://tryverseai.com/about" />
      </Helmet>
      <Navbar />
      <main className="pt-[var(--navbar-height)] pb-0">
        <div className="max-w-7xl mx-auto px-6">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12 sm:mb-16 md:mb-20 max-w-3xl mx-auto"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">About</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              Building the Infrastructure for Fashion's Digital Future
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              TryVerse is building the infrastructure layer for AI-powered fashion commerce. We help brands turn
              static digital catalogs into richer, more interactive experiences — from virtual try-on and product
              visualization to AI-powered fashion content.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mt-4">
              The goal isn't simply to help brands display products differently. It's to make digital fashion feel
              more like experiencing fashion in the real world.
            </p>
          </motion.div>

          {/* Mission */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`${glassOuter} mb-12 sm:mb-16 md:mb-20`}
          >
            <div className={cn(glassInner, "p-8 md:p-10 lg:p-14")}>
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Our Mission</p>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Building the Infrastructure Layer for Fashion Visualization
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Fashion was built around movement, context, and fit. Yet most online shopping still begins with a
                  static image. TryVerse exists to close that gap. We're building the infrastructure that allows
                  brands, marketplaces, and commerce platforms to transform the way products are experienced online —
                  giving shoppers more context, more confidence, and a more engaging path to purchase.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Virtual try-on is where we started. The bigger vision is to become the visualization infrastructure
                  that powers the next generation of digital fashion commerce.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "AI-Powered", label: "Fashion infrastructure" },
                  { value: "Built for", label: "Real-world commerce" },
                  { value: "Production", label: "Ready" },
                  { value: "∞", label: "Scalability" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-5 rounded-xl bg-muted/50">
                    <p className="font-display text-lg font-bold text-foreground leading-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </motion.div>

          {/* Values */}
          <div className="mb-12 sm:mb-16 md:mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-display text-3xl font-bold text-foreground mb-3">What We Stand For</h2>
            </motion.div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
              {values.map((v, i) => (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, ease: GLASS_EASE }}
                  whileHover={{ y: -4, transition: { duration: 0.65, ease: GLASS_EASE } }}
                  className={glassOuter}
                >
                  <div className={glassInnerCard}>
                    <div className="relative z-[2] w-11 h-11 rounded-xl gradient-primary flex items-center justify-center mb-5 shadow-soft">
                      <v.icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <h3 className="relative z-[2] font-display text-lg font-semibold text-foreground mb-2">{v.title}</h3>
                    <p className="relative z-[2] text-sm text-muted-foreground leading-relaxed flex-1">{v.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default About;
