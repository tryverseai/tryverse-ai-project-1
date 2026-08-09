import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RevealLines } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Editorial hero: type-led left column, a single dominant campaign plate on the right.
 * One image, given room, not a collage — the first frame is the finished photograph.
 */
export function HeroSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yPrimary = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-14%"]);
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, reduce ? 1 : 0.25]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden pt-[calc(var(--navbar-height)+2.5rem)] md:pt-[calc(var(--navbar-height)+4rem)]"
      aria-label="TryVerse virtual try-on"
    >
      <div className="mx-auto grid w-full max-w-[78rem] grid-cols-1 items-center gap-14 px-6 pb-24 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-36">
        {/* ---- Type column ---- */}
        <motion.div className="relative z-10" style={{ opacity: fade }}>
          <motion.p
            className="type-eyebrow mb-8 flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <span className="h-px w-8 bg-current opacity-40" aria-hidden="true" />
            Virtual try-on infrastructure
          </motion.p>

          <h1 className="type-hero text-balance">
            <RevealLines
              lines={[
                <>See yourself</>,
                <>
                  <em className="font-normal italic">before</em> you buy.
                </>,
              ]}
            />
          </h1>

          <motion.p
            className="type-lead mt-8 max-w-lg text-pretty"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          >
            AI virtual try-on for fashion brands. One photo, and your shopper sees the garment on their own body —
            rendered on your product page, in your storefront, through your API.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.62, ease: EASE }}
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

          <motion.dl
            className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.8 }}
          >
            {[
              { term: "Fashion commerce", detail: "Built for apparel catalogues" },
              { term: "Enterprise platform", detail: "Roles, domains, audit" },
              { term: "API first", detail: "Embed or call directly" },
            ].map((item) => (
              <div key={item.term}>
                <dt className="text-[0.8125rem] font-medium leading-snug text-foreground">{item.term}</dt>
                <dd className="type-caption mt-1 leading-snug">{item.detail}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        {/* ---- Campaign column — one image, given room ---- */}
        <div className="relative">
          <motion.figure
            style={{ y: yPrimary }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.2, ease: EASE }}
            className="relative ml-auto w-full overflow-hidden rounded-[var(--radius-xl)] studio-frame shadow-[var(--shadow-elevated)]"
          >
            <div className="aspect-[4/5] lg:aspect-[3/4]">
              <img
                src={campaign.transit.src}
                alt={campaign.transit.alt}
                // eslint-disable-next-line react/no-unknown-property
                {...{ fetchpriority: "high" }}
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 scrim opacity-70" aria-hidden="true" />
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-5">
              <p className="type-eyebrow text-[hsl(40_16%_95%)]">Rendered on the shopper</p>
            </figcaption>
          </motion.figure>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 lg:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1.1 }}
        aria-hidden="true"
      >
        <span className="type-eyebrow">Scroll</span>
        <span className="relative block h-10 w-px overflow-hidden bg-border">
          <span className="absolute inset-x-0 top-0 block h-1/2 bg-foreground animate-scroll-cue" />
        </span>
      </motion.div>
    </section>
  );
}
