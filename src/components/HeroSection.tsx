import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
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

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative pt-[var(--navbar-height)] pb-20 md:pt-[calc(var(--navbar-height)+1rem)] md:pb-28 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 1, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border text-foreground text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
            Virtual try-on infrastructure for fashion brands
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-foreground mb-6">
            Reduce Returns.{" "}
            <span className="text-muted-foreground">Increase Conversions.</span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
            Integrate AI virtual try-on into your storefront in minutes. Help customers visualize products before
            purchase, reduce uncertainty, and improve conversion performance across your catalog.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Link to="/book-demo">
              <Button
                size="lg"
                className="gradient-primary text-primary-foreground shadow-soft text-base px-8 h-12 w-full sm:w-auto"
              >
                Book a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth?signup=business">
              <Button size="lg" variant="outline" className="text-base h-12 border-border w-full sm:w-auto">
                Sign Up
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="ghost" className="text-base h-12 w-full sm:w-auto">
                Learn More
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-8 max-w-md mx-auto">
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
          </div>
        </motion.div>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: shouldReduceMotion ? 0 : 0.15, ease: "easeOut" }}
          className="mt-16"
          aria-label="Virtual try-on examples"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {HERO_MODELS.map((model, i) => (
              <motion.div
                key={i}
                className="relative rounded-2xl overflow-hidden shadow-elevated border border-border/30 aspect-[3/4]"
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
