import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CTASection } from "@/components/CTASection";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GLASS_EASE, glassOuter, glassInner, glassInnerCard } from "@/lib/glassFrame";
import { Globe, Target, Zap, Layers } from "lucide-react";
import { Helmet } from "react-helmet-async";

const values = [
  {
    icon: Target,
    title: "Precision",
    description: "Every pixel matters. We build AI that produces photorealistic results brands can trust.",
  },
  {
    icon: Layers,
    title: "Infrastructure",
    description: "Built as a platform, not a single feature — the visualization layer commerce is missing.",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description: "Infrastructure designed to scale with your brand and handle growing demand, worldwide.",
  },
  {
    icon: Zap,
    title: "Speed",
    description: "Sub-second inference on cloud GPUs, delivering instant results to shoppers worldwide.",
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
              TryVerse is AI infrastructure for fashion visualization — virtual try-on, AI model photography, and
              outfit visualization for online fashion commerce. We're building tools to help brands sell more,
              reduce returns, and build customer trust.
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
                  Fashion commerce runs on static photos in a category built for motion and fit. TryVerse exists to
                  close that gap — the AI infrastructure layer that lets any brand, marketplace, or platform turn a
                  product photo into a visualization a shopper can actually trust. Virtual try-on is where we
                  started; the vision is the visualization and commerce layer the next generation of global fashion
                  brands builds on.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "AI", label: "Powered engine" },
                  { value: "<1s", label: "Try-on speed" },
                  { value: "99%", label: "Uptime goal" },
                  { value: "∞", label: "Scalability" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-5 rounded-xl bg-muted/50">
                    <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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
