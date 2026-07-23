import { motion } from "framer-motion";
import { Upload, Zap, ShoppingBag } from "lucide-react";
import { GLASS_EASE, glassOuter, glassInnerCard, glassSectionBackdrop } from "@/lib/glassFrame";

const steps = [
  {
    icon: ShoppingBag,
    step: "01",
    title: "Shopper Selects a Product",
    description:
      "On your product page, shoppers tap Try On — no extra steps, no friction. The widget opens right on your PDP.",
  },
  {
    icon: Upload,
    step: "02",
    title: "Upload or Snap a Photo",
    description:
      "Shoppers upload a photo or choose from your model library. TryVerse handles pose detection and garment alignment automatically.",
  },
  {
    icon: Zap,
    step: "03",
    title: "See It Styled Instantly",
    description:
      "Photorealistic try-on results in under a second — shoppers buy with confidence, and your return rate drops.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-white py-16 sm:py-24 md:py-32 overflow-hidden">
      <div className={glassSectionBackdrop} aria-hidden />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-14 md:mb-16 max-w-3xl mx-auto"
        >
          <p className="text-xs font-medium text-muted-foreground mb-2 sm:mb-3 tracking-[0.2em] uppercase">
            How It Works
          </p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 sm:mb-4 leading-tight px-1">
            Try Before You Buy — On Your Store
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed px-1">
            Three steps from product page to photorealistic try-on — embedded directly in your storefront, powered by
            the same AI your brand controls from the dashboard.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 md:gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: Math.min(i * 0.12, 0.36), duration: 0.8, ease: GLASS_EASE }}
              whileHover={{
                y: -6,
                transition: { duration: 0.7, ease: GLASS_EASE },
              }}
              className={glassOuter}
            >
              <div className={`${glassInnerCard} gap-4`}>
                <div className="relative z-[2] flex items-center justify-between gap-3">
                  <span
                    className="inline-flex items-center rounded-full border border-border/50 bg-background/70 px-3 py-1 text-[11px] font-semibold tabular-nums tracking-wide text-foreground/80 shadow-sm"
                    aria-label={`Step ${step.step}`}
                  >
                    {step.step}
                  </span>
                </div>

                <div className="relative z-[2] flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-soft transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]">
                  <step.icon className="h-5 w-5 text-primary-foreground" strokeWidth={2} />
                </div>

                <h3 className="relative z-[2] font-display text-lg sm:text-xl font-semibold text-foreground leading-snug">
                  {step.title}
                </h3>

                <p className="relative z-[2] text-sm leading-relaxed text-muted-foreground flex-1">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
