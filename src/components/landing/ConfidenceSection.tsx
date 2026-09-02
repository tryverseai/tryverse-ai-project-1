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
          <RevealLines lines={[<>Turn fashion assets</>, <>into intelligent experiences.</>]} />
        </h2>
        <div className="mt-9 flex flex-col gap-6">
          <Reveal delay={0.18} className="max-w-lg">
            <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.7)]">
              Fashion brands have traditionally relied on static product images and expensive, repetitive content
              production to bring products to life. TryVerse transforms a single fashion product into infrastructure
              for creating, visualizing and scaling new experiences.
            </p>
          </Reveal>
          <Reveal delay={0.24} className="max-w-lg">
            <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.7)]">
              The same product can power virtual try-ons, complete looks, AI models, product photography, photoshoots
              and fashion video — without rebuilding the workflow from scratch each time.
            </p>
          </Reveal>
          <Reveal delay={0.32} className="max-w-lg">
            <p className="type-title text-balance text-[hsl(40_16%_95%)]">
              More possibilities from every product. More intelligent experiences for fashion brands.
            </p>
          </Reveal>
        </div>
      </div>

      {/* The photograph carries the rest of the section — full width, no card, no border. */}
      <div ref={ref} className="relative mt-16 overflow-hidden md:mt-24">
        <div className="aspect-[3/2] sm:aspect-[16/10] lg:aspect-[21/9]">
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
      </div>
    </section>
  );
}
