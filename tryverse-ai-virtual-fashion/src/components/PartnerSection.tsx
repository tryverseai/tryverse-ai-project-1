import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Globe, Zap, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const reasons = [
  { icon: Sparkles, title: "AI-Powered Try-On", description: "Let shoppers see products on themselves before buying." },
  { icon: Globe, title: "Global Scale", description: "Infrastructure built to scale with brands worldwide." },
  { icon: Zap, title: "Simple Integration", description: "Embed TryVerse into your store with a few lines of code." },
  { icon: Shield, title: "Enterprise Ready", description: "Secure, reliable, and designed for production workloads." },
];

export function PartnerSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">Partner With Us</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Bring Your Collection to Life
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Partner with TryVerse to give your customers the confidence to buy — and the experience that keeps them coming back.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {reasons.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="p-7 rounded-2xl border border-border/50 hover:border-foreground/10 hover:shadow-elevated transition-all duration-300 group text-center"
            >
              <div className="w-11 h-11 rounded-xl bg-foreground/[0.06] flex items-center justify-center mb-5 mx-auto group-hover:gradient-primary group-hover:shadow-soft transition-all duration-300">
                <item.icon className="h-5 w-5 text-foreground group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/auth?signup=true">
            <Button size="lg" className="gradient-primary text-primary-foreground shadow-soft text-base px-8 h-12">
              Start Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
