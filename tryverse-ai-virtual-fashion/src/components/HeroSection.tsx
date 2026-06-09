import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section className="relative pt-[var(--navbar-height)] pb-20 md:pt-[calc(var(--navbar-height)+1rem)] md:pb-28 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 1, y: 15 }}
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

          <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-2xl mx-auto">
            AI-powered virtual try-on for <span className="text-foreground font-medium">fashion brands and e-commerce retailers</span>.
            Embed try-on on your product pages in minutes — give shoppers confidence before they buy.
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto border border-border/60 rounded-xl px-5 py-4 bg-muted/30">
            TryVerse is built exclusively for fashion brands, e-commerce retailers, and online stores. We help brands
            reduce returns and increase conversions by embedding AI virtual try-on directly on their product pages.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <Link to="/book-demo">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-soft text-base px-8 h-12 w-full sm:w-auto">
                Book a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth?signup=business">
              <Button size="lg" variant="outline" className="text-base h-12 border-border w-full sm:w-auto">
                Create Brand Account
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
      </div>
    </section>
  );
}
