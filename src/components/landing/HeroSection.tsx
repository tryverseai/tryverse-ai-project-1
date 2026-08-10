import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RevealLines } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Full-bleed cinematic open: one photograph fills the viewport behind the transparent
 * navbar. Content is pinned to a scrim band at the bottom of the frame — the only zone
 * that stays clear of her face on every breakpoint, since object-cover shows her full
 * height on narrow viewports (cropping happens on the sides, not top-to-bottom).
 * Full height on every breakpoint — this is the cover, not a card.
 */
export function HeroSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "16%"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.05, 1.16]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, reduce ? 1 : 0]);

  return (
    <section
      ref={ref}
      aria-label="TryVerse virtual try-on"
      className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-[hsl(var(--ink))]"
    >
      <motion.img
        src={campaign.crowd.src}
        alt={campaign.crowd.alt}
        // eslint-disable-next-line react/no-unknown-property
        {...{ fetchpriority: "high" }}
        decoding="async"
        style={{ y, scale }}
        className="absolute inset-0 h-full w-full object-cover object-center will-change-transform"
      />
      {/* Legibility scrim: clear over her face and shoulders, solid across the lower band where the copy sits. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(to top, hsl(var(--ink)) 0%, hsl(var(--ink)) 55%, transparent 70%)",
        }}
      />
      {/* Thin top wash so the transparent navbar's wordmark stays legible over the frame. */}
      <div
        className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[hsl(var(--ink))]/35 to-transparent"
        aria-hidden="true"
      />

      <motion.div className="relative mx-auto w-full max-w-[78rem] px-6 pb-14 pt-24 md:px-10 md:pb-20" style={{ opacity: fade }}>
        <motion.p
          className="type-eyebrow mb-8 flex items-center gap-3 text-[hsl(40_16%_95%/0.65)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <span className="h-px w-8 bg-current opacity-40" aria-hidden="true" />
          Virtual try-on infrastructure
        </motion.p>

        <h1 className="type-hero max-w-2xl text-balance text-[hsl(40_16%_95%)]">
          <RevealLines
            lines={[
              <>Experience it</>,
              <>
                on <em className="font-normal italic">You</em>.
              </>,
            ]}
          />
        </h1>

        <motion.p
          className="type-lead mt-8 max-w-md text-pretty text-[hsl(40_16%_95%/0.75)]"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
        >
          AI virtual try-on for fashion brands. One photo, and your shopper sees the product on their own body.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.62, ease: EASE }}
        >
          <Link to="/auth?signup=business" className="w-full sm:w-auto">
            <Button size="xl" variant="contrast" className="group w-full sm:w-auto">
              Start free
              <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>
          </Link>
          <Link to="/book-demo" className="w-full sm:w-auto">
            <Button size="xl" variant="onInk" className="w-full sm:w-auto">
              Book a demo
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
