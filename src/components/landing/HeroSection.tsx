import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/layout/Section";
import { RevealLines } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

const EASE = [0.16, 1, 0.3, 1] as const;

const HERO_LINES = [
  <>Turn fashion products</>,
  <>
    into <em className="font-normal italic">visual experiences</em>.
  </>,
];

/**
 * Full-bleed on desktop — one photograph fills the screen, the way the reference (SPREEAI)
 * does it. The copy sits in a solid card, not a translucent scrim: a card fully occludes
 * whatever is behind it, so "does the model show through the text" is never a question we
 * have to get right by tuning gradient opacity. Positioned off-center (bottom-left) because
 * she sits dead-center in this photograph — the card sits in the crowd/background zone, not
 * on her, regardless of exactly how the crop lands at a given viewport width.
 * Mobile keeps the stacked image-then-copy layout from the previous pass, unchanged — a
 * genuinely different composition, not the desktop layout scaled down, and never the part
 * that drew a complaint.
 */
export function HeroSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "8%"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1, 1.06]);
  const veilOpacity = useTransform(scrollYProgress, [0.6, 1], reduce ? [0, 0] : [0, 1]);

  return (
    <section
      ref={ref}
      aria-label="TryVerse AI infrastructure for fashion visualization"
      className="relative min-h-[100svh] overflow-hidden bg-background"
    >
      {/* Desktop — full-bleed. */}
      <div className="hidden md:block">
        <motion.img
          src={campaign.crowd.src}
          alt={campaign.crowd.alt}
          // eslint-disable-next-line react/no-unknown-property
          {...{ fetchpriority: "high" }}
          decoding="async"
          style={{ y, scale }}
          className="absolute inset-0 h-full w-full object-cover object-[50%_22%] will-change-transform"
        />

        <div className="absolute bottom-10 left-6 z-10 max-w-sm rounded-[1.5rem] bg-[hsl(var(--ink)/0.94)] p-8 backdrop-blur-sm lg:left-10 lg:p-9">
          <Eyebrow className="mb-6 text-[hsl(40_16%_95%/0.6)]">AI infrastructure for fashion visualization</Eyebrow>
          <h1 className="type-title max-w-xs text-balance text-[hsl(40_16%_95%)]">
            <RevealLines lines={HERO_LINES} />
          </h1>
          <motion.div
            className="mt-7 flex items-center gap-4"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          >
            <Link to="/auth?signup=business">
              <Button size="lg" variant="contrast" className="group">
                Start free
                <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
            </Link>
            <Link
              to="/book-demo"
              className="underline-sweep type-body text-[hsl(40_16%_95%/0.75)] transition-colors duration-200 hover:text-[hsl(40_16%_95%)]"
            >
              Book a demo
            </Link>
          </motion.div>
        </div>

        {/* Pre-tint toward the next (ink) section as the hero is about to hand off — no text in it. */}
        <motion.div
          style={{ opacity: veilOpacity }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[hsl(var(--ink))]"
          aria-hidden="true"
        />
      </div>

      {/* Mobile — stacked: image first, copy clears it entirely, generous spacing. */}
      <div className="flex min-h-[100svh] flex-col justify-center px-6 pb-16 pt-[calc(var(--navbar-height)+1.5rem)] md:hidden">
        <div className="overflow-hidden rounded-[1.75rem] bg-secondary">
          <div className="aspect-[4/5] sm:aspect-[3/4]">
            <img
              src={campaign.crowd.src}
              alt={campaign.crowd.alt}
              decoding="async"
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>

        <div className="py-2">
          <Eyebrow className="mb-8 mt-8">AI infrastructure for fashion visualization</Eyebrow>

          <h1 className="type-hero max-w-xl text-balance">
            <RevealLines lines={HERO_LINES} />
          </h1>

          <motion.div
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          >
            <Link to="/auth?signup=business" className="w-full sm:w-auto">
              <Button size="xl" className="group w-full sm:w-auto">
                Start free
                <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
            </Link>
            <Link to="/book-demo" className="w-full sm:w-auto">
              <Button size="xl" variant="outline" className="w-full sm:w-auto">
                Book a demo
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
