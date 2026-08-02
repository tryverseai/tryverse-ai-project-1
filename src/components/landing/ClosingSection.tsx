import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import { RevealLines, Reveal } from "@/components/motion/Reveal";
import loopClosing from "@/assets/loop-4.mp4";
import loopClosingPoster from "@/assets/loop-4-poster.jpg";

/** Final beat: full-bleed film, one instruction. */
export function ClosingSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-8%", "8%"]);

  return (
    <section
      ref={ref}
      aria-label="Get started with TryVerse"
      className="relative isolate overflow-hidden bg-[hsl(var(--ink))]"
    >
      <motion.div className="absolute inset-0" style={{ y, scale: reduce ? 1 : 1.15 }} aria-hidden="true">
        <AutoPlayVideo src={loopClosing} poster={loopClosingPoster} className="h-full w-full object-cover" />
      </motion.div>
      <div className="absolute inset-0 bg-[hsl(var(--ink))]/78" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-[78rem] px-6 py-32 md:px-10 md:py-48">
        <p className="type-eyebrow mb-10 text-[hsl(40_16%_95%/0.6)]">09 — Get started</p>
        <h2 className="type-display max-w-3xl text-balance text-[hsl(40_16%_95%)]">
          <RevealLines
            lines={[
              <>Put the fitting room</>,
              <>
                <em className="font-normal italic">inside</em> the product page.
              </>,
            ]}
          />
        </h2>

        <Reveal delay={0.18} className="mt-10 max-w-xl">
          <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.7)]">
            Create a brand account, run your first try-ons on your own catalogue, and decide from the results.
          </p>
        </Reveal>

        <Reveal delay={0.28} className="mt-12">
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
