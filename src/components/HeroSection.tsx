import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import heroVideo1 from "@/assets/hero-video-1.mp4";
import heroVideo2 from "@/assets/hero-video-2.mp4";
import heroVideo3 from "@/assets/hero-video-3.mp4";
import heroVideo4 from "@/assets/hero-video-4.mp4";
import heroModel1 from "@/assets/hero-model-1.jpg";
import heroModel2 from "@/assets/hero-model-2.jpg";
import heroModel3 from "@/assets/hero-model-3.jpg";
import heroModel4 from "@/assets/hero-model-4.jpg";

/** Four hero try-on motion clips — always shown below the hero CTA copy. */
const HERO_MODELS = [
  { video: heroVideo1, poster: heroModel1 },
  { video: heroVideo2, poster: heroModel2 },
  { video: heroVideo3, poster: heroModel3 },
  { video: heroVideo4, poster: heroModel4 },
] as const;

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative pt-[var(--navbar-height)] pb-20 md:pt-[calc(var(--navbar-height)+1rem)] md:pb-28 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          variants={containerVariants}
          initial={shouldReduceMotion ? false : "hidden"}
          animate="show"
          className="text-center max-w-3xl mx-auto"
        >
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-foreground text-xs font-medium mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse motion-reduce:animate-none" />
            Virtual try-on infrastructure for fashion brands
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-display text-4xl md:text-5xl lg:text-[3.75rem] font-bold leading-[1.08] tracking-tight text-foreground mb-6"
          >
            See Yourself{" "}
            <span className="text-muted-foreground">Before You Buy.</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto"
          >
            AI virtual try-on for fashion brands — shoppers see exactly how a garment fits before they purchase.
            Fewer returns, more confident checkouts, higher conversion, embedded directly in your storefront.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Link to="/auth?signup=business">
              <Button
                size="lg"
                className="gradient-primary text-primary-foreground shadow-soft text-base px-8 h-12 w-full sm:w-auto transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/book-demo">
              <Button
                size="lg"
                variant="outline"
                className="text-base h-12 border-border w-full sm:w-auto transition-transform duration-300 hover:-translate-y-0.5 active:translate-y-0"
              >
                Book a Demo
              </Button>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-5">
            <a
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              See how it works
            </a>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-12 grid grid-cols-3 gap-8 max-w-md mx-auto">
            {[
              { value: "20", label: "Free Try-Ons" },
              { value: "<1s", label: "Processing" },
              { value: "99%", label: "Uptime" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-2xl md:text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: shouldReduceMotion ? 0 : 0.4, ease: "easeOut" }}
          className="mt-16"
          aria-label="Virtual try-on examples"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {HERO_MODELS.map((model, i) => (
              <motion.div
                key={i}
                className="relative rounded-2xl overflow-hidden shadow-elevated border border-border/30 aspect-[3/4] transition-transform duration-500 hover:-translate-y-1"
                animate={shouldReduceMotion ? {} : { y: [0, -8, 0] }}
                transition={
                  shouldReduceMotion
                    ? {}
                    : {
                        duration: 4 + i * 0.7,
                        repeat: Infinity,
                        repeatType: "loop",
                        ease: "easeInOut",
                        delay: i * 0.4,
                      }
                }
              >
                <AutoPlayVideo src={model.video} poster={model.poster} className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
