import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal, RevealLines } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

/**
 * Act two: the argument, then the room to see it. Type sets up the idea in a single
 * measure-width column; the photograph then takes the section over almost edge to edge —
 * no split-screen card fighting it for attention.
 */
export function ConfidenceSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-9%", "9%"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.1, 1]);

  return (
    <section aria-label="Why confidence matters" className="relative bg-[hsl(var(--ink))] text-[hsl(40_16%_95%)]">
      <div className="mx-auto w-full max-w-[78rem] px-6 pt-28 md:px-10 md:pt-40">
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
        <div className="mt-9 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <Reveal delay={0.18} className="max-w-lg">
            <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.7)]">
              Every product page asks the shopper to imagine. Remove the imagining, and the decision gets easier —
              for them, and for the brand carrying the return.
            </p>
          </Reveal>
          <Reveal delay={0.28} className="max-w-sm shrink-0">
            <blockquote className="border-l border-[hsl(40_16%_95%/0.25)] pl-6">
              <p className="type-title text-balance text-[hsl(40_16%_95%)]">
                &ldquo;The seat is empty because the shopper hasn&apos;t seen themselves in it yet.&rdquo;
              </p>
            </blockquote>
          </Reveal>
        </div>
      </div>

      {/* The photograph carries the rest of the section — full width, no card, no border. */}
      <div ref={ref} className="relative mt-16 overflow-hidden md:mt-24">
        <div className="aspect-[4/5] sm:aspect-[16/10] lg:aspect-[21/9]">
          <motion.img
            src={campaign.seatedTrio.src}
            alt={campaign.seatedTrio.alt}
            loading="lazy"
            decoding="async"
            style={{ y, scale }}
            className="h-full w-full object-cover will-change-transform"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[hsl(var(--ink))] to-transparent"
          aria-hidden="true"
        />
        <p className="pointer-events-none absolute bottom-6 left-6 type-eyebrow text-[hsl(40_16%_95%/0.75)] md:bottom-8 md:left-10">
          Ensemble — three fits, one open seat
        </p>
      </div>
    </section>
  );
}
