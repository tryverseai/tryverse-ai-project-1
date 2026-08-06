import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal, RevealLines } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

/**
 * Act two: an editorial spread. Three fits, one empty seat — the argument for
 * confidence told entirely in photography and type, with no motion assets.
 */
export function ConfidenceSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-8%", "8%"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.12, 1]);

  return (
    <section
      aria-label="Why confidence matters"
      className="relative bg-[hsl(var(--ink))] text-[hsl(40_16%_95%)]"
    >
      <div className="mx-auto grid w-full max-w-[78rem] grid-cols-1 gap-14 px-6 py-28 md:px-10 md:py-40 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
        <div>
          <p className="type-eyebrow mb-8 flex items-center gap-3 text-[hsl(40_16%_95%/0.6)]">
            <span className="tabular-nums opacity-70">02</span>
            <span className="h-px w-6 bg-current opacity-40" aria-hidden="true" />
            Why it matters
          </p>
          <h2 className="type-display max-w-2xl text-balance">
            <RevealLines
              lines={[
                <>Confidence is the</>,
                <>
                  <em className="font-normal italic">only</em> thing between
                </>,
                <>a browse and a purchase.</>,
              ]}
            />
          </h2>
          <Reveal delay={0.18} className="mt-9 max-w-lg">
            <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.7)]">
              Every product page asks the shopper to imagine. Remove the imagining, and the decision gets easier —
              for them, and for the brand carrying the return.
            </p>
          </Reveal>

          <Reveal delay={0.28} className="mt-14">
            <blockquote className="max-w-md border-l border-[hsl(40_16%_95%/0.25)] pl-6">
              <p className="type-title text-balance text-[hsl(40_16%_95%)]">
                &ldquo;The seat is empty because the shopper hasn&apos;t seen themselves in it yet.&rdquo;
              </p>
            </blockquote>
          </Reveal>
        </div>

        <div ref={ref} className="relative">
          <figure className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[hsl(40_16%_95%/0.14)]">
            <div className="aspect-[4/5] overflow-hidden">
              <motion.img
                src={campaign.seatedTrio.src}
                alt={campaign.seatedTrio.alt}
                loading="lazy"
                decoding="async"
                style={{ y, scale }}
                className="h-full w-full object-cover will-change-transform"
              />
            </div>
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 p-6">
              <span className="type-eyebrow text-[hsl(40_16%_95%/0.8)]">Ensemble — three fits, one open seat</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
