import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { campaign } from "@/lib/campaignImagery";

const EASE = [0.16, 1, 0.3, 1] as const;
const STATEMENT = "AI infrastructure for the future of fashion commerce.";
const SUPPORTING_COPY =
  "Power virtual try-on, AI model generation, product visualization, and campaign content through a single intelligent platform — built to integrate directly into your storefront.";

/**
 * Full-bleed on both breakpoints, same treatment: photograph fills the screen, statement
 * sits centered in the empty band below her, no card, no separate section.
 *
 * Desktop's wide container over a portrait source already crops to head-to-waist via
 * object-fit alone (verified against the live DOM: her figure ends at ~61% of the frame).
 * Mobile's narrow container doesn't get that crop for free — object-cover on a portrait
 * viewport shows her full figure top-to-bottom with nothing to spare. `scale-[1.82]
 * origin-top` re-creates the same effect deliberately: it zooms into the already-cover-fitted
 * image from its top edge, so the visible window becomes the top ~55% of the photo (her head
 * to roughly her waist) and the bottom ~45% — her legs, the block she's seated on — is pushed
 * out of frame by the surrounding `overflow-hidden`, leaving the same kind of empty lower band
 * desktop gets from its aspect ratio alone.
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
      {/* Desktop — full-bleed, statement centered in the empty zone below her. */}
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

        {/* Legibility scrim — confined to the empty lower band, never reaches her figure. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[hsl(var(--ink)/0.8)] to-transparent"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 bottom-14 z-10 flex flex-col items-center px-6 text-center lg:bottom-16">
          <motion.h1
            className="type-title max-w-xl text-balance text-[hsl(40_16%_95%)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            {STATEMENT}
          </motion.h1>
          <motion.p
            className="type-body mt-5 max-w-lg text-balance text-[hsl(40_16%_95%/0.78)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
          >
            {SUPPORTING_COPY}
          </motion.p>
          <motion.div
            className="mt-7 flex items-center gap-4"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
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

      {/* Mobile — full-bleed, same overlay treatment as desktop. */}
      <div className="relative min-h-[100svh] overflow-hidden md:hidden">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={campaign.crowd.src}
            alt={campaign.crowd.alt}
            // eslint-disable-next-line react/no-unknown-property
            {...{ fetchpriority: "high" }}
            decoding="async"
            className="h-full w-full origin-top scale-[1.82] object-cover object-[50%_0%]"
          />
        </div>

        {/* Legibility scrim — confined to the empty lower band the zoom just created, never reaches her figure. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-[hsl(var(--ink)/0.82)] to-transparent"
          aria-hidden="true"
        />

        <div className="absolute inset-x-0 bottom-12 z-10 flex flex-col items-center px-6 text-center">
          <motion.h1
            className="type-heading max-w-xs text-balance text-[hsl(40_16%_95%)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            {STATEMENT}
          </motion.h1>
          <motion.p
            className="type-caption mt-4 max-w-xs text-balance text-[hsl(40_16%_95%/0.78)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          >
            {SUPPORTING_COPY}
          </motion.p>
          <motion.div
            className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
          >
            <Link to="/auth?signup=business" className="w-full sm:w-auto">
              <Button size="lg" variant="contrast" className="group w-full sm:w-auto">
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
      </div>
    </section>
  );
}
