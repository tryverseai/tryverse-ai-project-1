import { motion } from "framer-motion";
import { Upload, Zap, ShoppingBag } from "lucide-react";

const steps = [
  {
    icon: ShoppingBag,
    step: "01",
    title: "Pick Your Style",
    description: "Shoppers select the item they love directly from your product page — no extra steps, no friction.",
  },
  {
    icon: Upload,
    step: "02",
    title: "Snap or Upload a Photo",
    description: "Choose how to try it on — snap a quick photo, upload one you already have, or pick from a selection of models.",
  },
  {
    icon: Zap,
    step: "03",
    title: "See It on You Instantly",
    description: "See it styled on you in seconds — effortless, exciting, and true to fit.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-xs font-medium text-muted-foreground mb-3 tracking-[0.2em] uppercase">How It Works</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Try Before You Buy — In Three Simple Steps
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            From browsing to trying on, it all happens right on your product page.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="relative bg-card rounded-2xl p-8 border border-border/50 hover:shadow-elevated transition-all duration-300 group"
            >
              <span className="absolute top-6 right-6 font-display text-5xl font-bold text-foreground/[0.06]">
                {step.step}
              </span>
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-6 shadow-soft">
                <step.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
