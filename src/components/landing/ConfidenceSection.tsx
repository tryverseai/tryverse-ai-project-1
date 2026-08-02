import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import { RevealLines, Reveal } from "@/components/motion/Reveal";
import loopConfidence from "@/assets/loop-3.mp4";
import loopConfidencePoster from "@/assets/loop-3-poster.jpg";

/**
 * Pinned cinematic beat between the problem and the solution.
 * The film sits behind the type and scales down as the viewer scrolls through it.
 */
export function ConfidenceSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reduce ? [1, 1, 1] : [1.16, 1, 1.06]);
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-6%", "6%"]);
  const veil = useTransform(scrollYProgress, [0, 0.45, 1], [0.72, 0.5, 0.78]);

  return (
    <section aria-label="Why confidence matters" className="relative bg-[hsl(var(--ink))]">
      <div ref={ref} className="relative h-[190vh]">
        <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
          <motion.div className="absolute inset-0" style={{ scale, y }} aria-hidden="true">
            <AutoPlayVideo
              src={loopConfidence}
              poster={loopConfidencePoster}
              className="h-full w-full object-cover"
            />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-[hsl(var(--ink))]"
            style={{ opacity: veil }}
            aria-hidden="true"
          />

          <div className="relative mx-auto w-full max-w-[78rem] px-6 md:px-10">
            <p className="type-eyebrow mb-8 text-[hsl(40_16%_95%/0.6)]">02 — Why it matters</p>
            <h2 className="type-display max-w-3xl text-balance text-[hsl(40_16%_95%)]">
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
            <Reveal delay={0.2} className="mt-8 max-w-xl">
              <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.7)]">
                Every product page asks the shopper to imagine. Remove the imagining, and the decision gets easier —
                for them, and for the brand carrying the return.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
