import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CTASection } from "@/components/CTASection";
import { motion } from "framer-motion";
import { Globe, Target, Zap } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Precision",
    description: "Every pixel matters. We build AI that produces photorealistic results brands can trust.",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description: "Infrastructure designed to scale with your brand and handle growing demand.",
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
      <Navbar />
      <main className="pt-28 pb-0">
        <div className="max-w-7xl mx-auto px-6">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20 max-w-3xl mx-auto"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">About</p>
            <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              Building the Infrastructure for Fashion's Digital Future
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              TryVerse AI is a virtual try-on and fit intelligence platform for online fashion commerce. We're building tools to help brands sell more, reduce returns, and build customer trust.
            </p>
          </motion.div>

          {/* Mission */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl border border-border/50 p-10 md:p-14 mb-20"
          >
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Our Mission</p>
                <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                  Making Online Shopping Feel Real
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  TryVerse AI exists to bridge the gap between physical and digital shopping. We believe every shopper deserves to see how a product will look and fit before they buy — and every brand deserves the tools to make that possible. We're building the AI infrastructure that powers the next generation of fashion commerce.
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
          </motion.div>

          {/* Values */}
          <div className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-display text-3xl font-bold text-foreground mb-3">What We Stand For</h2>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {values.map((v, i) => (
                <motion.div
                  key={v.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-7 rounded-2xl border border-border/50"
                >
                  <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center mb-5 shadow-soft">
                    <v.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
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
