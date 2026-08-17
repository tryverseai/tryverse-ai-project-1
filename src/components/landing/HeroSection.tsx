import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { campaign } from "@/lib/campaignImagery";

const EASE = [0.16, 1, 0.3, 1] as const;
const STATEMENT = "AI infrastructure for fashion visualization.";

/**
 * Full-bleed on desktop. The photograph's crop (object-position 22% from top, wide
 * container over a portrait source) only shows her from the head down to roughly the
 * waist — the bottom third of the frame is empty floor/crowd, which is where the
 * statement sits: centered, directly under her, no card, just a soft scrim for
 * legibility. Mobile crops to her full figure top-to-bottom instead (portrait viewport,
 * portrait source), so there's no safe zone to overlay — the caption runs directly
 * below the full-bleed image instead, same as the SPREEAI reference.
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

      {/* Mobile — full-bleed edge to edge, statement runs below the image (her full figure fills the crop, so nothing overlays her). */}
      <div className="flex min-h-[100svh] flex-col md:hidden">
        <div className="h-[78svh] w-full overflow-hidden">
          <img
            src={campaign.crowd.src}
            alt={campaign.crowd.alt}
            // eslint-disable-next-line react/no-unknown-property
            {...{ fetchpriority: "high" }}
            decoding="async"
            className="h-full w-full object-cover object-[50%_18%]"
          />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center">
          <motion.h1
            className="type-heading max-w-xs text-balance"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            {STATEMENT}
          </motion.h1>
          <motion.div
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
          >
            <Link to="/auth?signup=business" className="w-full sm:w-auto">
              <Button size="lg" className="group w-full sm:w-auto">
                Start free
                <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Button>
            </Link>
            <Link to="/book-demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Book a demo
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
