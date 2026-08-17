import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/layout/Section";
import { RevealLines } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Editorial split, not a cinematic cover: the photograph keeps its own frame instead of
 * being cropped full-bleed behind type. Mobile stacks image-then-copy so the model reads
 * first, on her own, before any headline; desktop sets them side by side, image-weighted,
 * so neither one sits on top of the other. No scrim, no text-over-face — legibility comes
 * from separation, not from covering her. Near-full-screen so it reads as the first act,
 * not a padded content block, and settles into a quiet hand-off as the next section arrives.
 */
export function HeroSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "8%"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1, 1.06]);

  // Hand-off beat: only active in the last stretch of the section's own scroll — the grid
  // settles back and a veil pre-tints the space beneath it toward ink, so the cut into the
  // next (ink-toned) section reads as intentional rather than an abrupt background swap.
  const contentOpacity = useTransform(scrollYProgress, [0.6, 1], reduce ? [1, 1] : [1, 0.9]);
  const contentScale = useTransform(scrollYProgress, [0.6, 1], reduce ? [1, 1] : [1, 0.97]);
  const veilOpacity = useTransform(scrollYProgress, [0.6, 1], reduce ? [0, 0] : [0, 1]);

  return (
    <section
      ref={ref}
      aria-label="TryVerse AI infrastructure for fashion visualization"
      className="relative flex min-h-[100svh] items-center bg-background pb-16 pt-[calc(var(--navbar-height)+1.5rem)] sm:pb-20 sm:pt-[calc(var(--navbar-height)+2.5rem)]"
    >
      <motion.div
        style={{ opacity: contentOpacity, scale: contentScale }}
        className="mx-auto grid w-full max-w-[78rem] grid-cols-1 items-center gap-10 px-6 md:grid-cols-[1.15fr_1fr] md:gap-14 md:px-10 lg:gap-20"
      >
        {/* Image — full frame, no crop beyond the container's own aspect ratio, no overlay. */}
        <div className="order-1 overflow-hidden rounded-[1.75rem] bg-secondary md:order-2">
          <div className="aspect-[4/5] sm:aspect-[3/4] md:aspect-[4/5]">
            <motion.img
              src={campaign.crowd.src}
              alt={campaign.crowd.alt}
              // eslint-disable-next-line react/no-unknown-property
              {...{ fetchpriority: "high" }}
              decoding="async"
              style={{ y, scale }}
              className="h-full w-full object-cover object-top will-change-transform"
            />
          </div>
        </div>

        {/* Copy — clears the image entirely, mobile and desktop alike. Minimal: eyebrow, headline, CTA. */}
        <div className="order-2 py-2 md:order-1 md:py-0">
          <Eyebrow className="mb-8">AI infrastructure for fashion visualization</Eyebrow>

          <h1 className="type-hero max-w-xl text-balance">
            <RevealLines
              lines={[
                <>Turn fashion products</>,
                <>
                  into <em className="font-normal italic">visual experiences</em>.
                </>,
              ]}
            />
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
      </motion.div>

      {/* Pre-tint the space beneath the grid toward ink as the section is about to hand off. */}
      <motion.div
        style={{ opacity: veilOpacity }}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[hsl(var(--ink))] sm:h-32"
        aria-hidden="true"
      />
    </section>
  );
}
