import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RevealLines, Reveal } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

/** Final beat: one full-bleed campaign frame, one instruction. */
export function ClosingSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-8%", "8%"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.16, 1.02]);

  return (
    <section
      ref={ref}
      aria-label="Get started with TryVerse"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[hsl(var(--ink))]"
    >
      <motion.img
        src={campaign.crowd.src}
        alt={campaign.crowd.alt}
        loading="lazy"
        decoding="async"
        style={{ y, scale }}
        className="absolute inset-0 h-full w-full object-cover object-[70%_center] will-change-transform md:object-[75%_center]"
      />
      {/* Legibility scrims: heavy on the left where the copy sits, clear on the right for the figure. */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--ink))] via-[hsl(var(--ink))]/80 to-[hsl(var(--ink))]/10"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--ink))] via-transparent to-[hsl(var(--ink))]/40 md:from-[hsl(var(--ink))]/70"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-[78rem] px-6 py-24 md:px-10 md:py-32">
        <p className="type-eyebrow mb-8 text-[hsl(40_16%_95%/0.6)] md:mb-10">01 — Get started</p>
        <h2 className="type-hero max-w-3xl text-balance text-[hsl(40_16%_95%)]">
          <RevealLines
            lines={[
              <>Put the fitting room</>,
              <>
                <em className="font-normal italic">inside</em> the product page.
              </>,
            ]}
          />
        </h2>

        <Reveal delay={0.18} className="mt-8 max-w-xl md:mt-10">
          <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.72)]">
            Create a brand account, run your first try-ons on your own catalogue, and decide from the results.
          </p>
        </Reveal>

        <Reveal delay={0.28} className="mt-10 md:mt-12">
          <div className="flex flex-col gap-3 sm:flex-row">
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}

