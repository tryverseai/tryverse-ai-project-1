import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import { RevealLines } from "@/components/motion/Reveal";
import reelA from "@/assets/reel-a.mp4.asset.json";
import reelAPoster from "@/assets/reel-a-poster.jpg.asset.json";
import reelB from "@/assets/reel-b.mp4.asset.json";
import reelBPoster from "@/assets/reel-b-poster.jpg.asset.json";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Editorial hero: type-led left column, two offset cinematic film cards on the right.
 * Parallax is scroll-linked (transform only) and disabled under reduced motion.
 */
export function HeroSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yPrimary = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-14%"]);
  const ySecondary = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-4%"]);

  return (
    <section
      ref={ref}
      className="relative overflow-hidden pt-[calc(var(--navbar-height)+2.5rem)] md:pt-[calc(var(--navbar-height)+4rem)]"
      aria-label="TryVerse virtual try-on"
    >
      <div className="mx-auto grid w-full max-w-[78rem] grid-cols-1 items-center gap-14 px-6 pb-20 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-32">
        {/* ---- Type column ---- */}
        <div className="relative z-10">
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
        </div>

        {/* ---- Film column ---- */}
        <div className="relative">
          <motion.div
            style={{ y: yPrimary }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.2, ease: EASE }}
            className="relative ml-auto w-[86%] overflow-hidden rounded-[var(--radius-xl)] studio-frame shadow-[var(--shadow-elevated)] sm:w-[78%] lg:w-[84%]"
          >
            <div className="aspect-[3/4]">
              <AutoPlayVideo
                src={reelB.url}
                poster={reelBPoster.url}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 scrim opacity-70" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
              <p className="type-eyebrow text-[hsl(40_16%_95%)]">Rendered on the shopper</p>
            </div>
          </motion.div>

          <motion.div
            style={{ y: ySecondary }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.45, ease: EASE }}
            className="absolute -bottom-8 left-0 w-[42%] overflow-hidden rounded-[var(--radius-lg)] border border-border/60 shadow-[var(--shadow-elevated)] sm:w-[38%] lg:-bottom-12 lg:w-[44%]"
          >
            <div className="aspect-[3/4]">
              <AutoPlayVideo src={reelA.url} poster={reelAPoster.url} className="h-full w-full object-cover" />
            </div>
          </motion.div>
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
