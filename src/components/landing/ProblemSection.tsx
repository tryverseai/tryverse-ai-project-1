import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal, RevealLines } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

const frictions = [
  {
    stat: "Guesswork",
    body: "A flat product photo on a studio model tells a shopper almost nothing about how a garment will sit on their own frame.",
  },
  {
    stat: "Hesitation",
    body: "Uncertainty stalls the checkout. Carts get abandoned at the exact moment a shopper is closest to buying.",
  },
  {
    stat: "Returns",
    body: "When the only way to find out is to order it, the fitting room moves into the customer's hallway — and back into your warehouse.",
  },
];

/**
 * Act one: name the problem. A still figure holds the frame while traffic smears past —
 * the picture resolves from blur to sharp as the viewer scrolls, which is the whole argument.
 */
export function ProblemSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.2, 1.02]);
  const blur = useTransform(scrollYProgress, [0, 0.4], reduce ? ["none", "none"] : ["blur(18px)", "blur(0px)"]);
  const veil = useTransform(scrollYProgress, [0, 0.4, 1], [0.9, 0.62, 0.88]);

  return (
    <section id="problem" aria-label="The problem" className="relative isolate overflow-hidden bg-[hsl(var(--ink))] text-[hsl(40_16%_95%)]">
      <div ref={ref} className="absolute inset-0" aria-hidden="true">
        <motion.img
          src={campaign.street.src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ scale, filter: blur }}
          className="h-full w-full object-cover will-change-transform"
        />
        <motion.div className="absolute inset-0 bg-[hsl(var(--ink))]" style={{ opacity: veil }} />
      </div>

      <div className="relative mx-auto w-full max-w-[78rem] px-6 py-28 md:px-10 md:py-44">
        <p className="type-eyebrow mb-10 flex items-center gap-3 text-[hsl(40_16%_95%/0.6)]">
          <span className="tabular-nums opacity-70">01</span>
          <span className="h-px w-6 bg-current opacity-40" aria-hidden="true" />
          The problem
        </p>

        <h2 className="type-display max-w-4xl text-balance">
          <RevealLines
            lines={[
              <>Online shopping still has</>,
              <>
                a <em className="font-normal italic">fitting room</em> problem.
              </>,
            ]}
          />
        </h2>

        <Reveal delay={0.15} className="mt-8 max-w-2xl">
          <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.7)]">
            It isn&apos;t a demand problem. Shoppers want the piece. They just can&apos;t tell whether it will look like
            that on them — so they hedge, they over-order, or they leave.
          </p>
        </Reveal>

        <div className="mt-24 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[hsl(40_16%_95%/0.16)] md:grid-cols-3">
          {frictions.map((item, i) => (
            <motion.div
              key={item.stat}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="group relative bg-[hsl(var(--ink))]/85 p-8 backdrop-blur-md transition-colors duration-700 hover:bg-[hsl(40_16%_95%/0.06)] md:p-10"
            >
              <span className="type-eyebrow text-[hsl(40_16%_95%/0.4)]">0{i + 1}</span>
              <p className="type-title mt-6 text-[hsl(40_16%_95%)]">{item.stat}</p>
              <p className="type-body mt-4 text-[hsl(40_16%_95%/0.62)]">{item.body}</p>
              <span className="absolute bottom-0 left-0 h-px w-0 bg-[hsl(40_16%_95%/0.6)] transition-[width] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-full" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
