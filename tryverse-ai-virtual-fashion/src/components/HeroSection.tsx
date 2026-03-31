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

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();
  const models = [
    { video: heroVideo1, poster: heroModel1 },
    { video: heroVideo2, poster: heroModel2 },
    { video: heroVideo3, poster: heroModel3 },
    { video: heroVideo4, poster: heroModel4 },
  ];

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
            Virtual try-on for brands &amp; shoppers
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] tracking-tight text-foreground mb-6">
            Experience It on You{" "}
            <span className="text-muted-foreground">First</span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
            AI-powered virtual try-on and fit intelligence for <span className="text-foreground font-medium">fashion brands</span> and for{" "}
            <span className="text-foreground font-medium">everyday shoppers</span>. Embed it on your store, or try outfits on yourself in a personal
            studio — boost confidence and conversions, cut returns, scale globally.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Link to="/auth">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-soft text-base px-8 h-12 w-full sm:w-auto">
                Sign up
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/early-access">
              <Button size="lg" variant="outline" className="text-base h-12 border-border w-full sm:w-auto">
                Join waitlist
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
              { value: "B2B", label: "+ B2C studio" },
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
          initial={shouldReduceMotion ? false : { opacity: 1, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.1, ease: "easeOut" }}
          className="mt-16"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {models.map((model, i) => (
              <div
                key={i}
                className="relative rounded-2xl overflow-hidden shadow-elevated border border-border/30 aspect-[3/4]"
              >
                <AutoPlayVideo
                  src={model.video}
                  poster={model.poster}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
