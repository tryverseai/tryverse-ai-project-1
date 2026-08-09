import { motion, useReducedMotion } from "framer-motion";
import { Reveal, RevealLines } from "@/components/motion/Reveal";

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
 * Act three: the problem, told in type alone. No photography here — the section
 * that comes right before it is the photograph; this one is the argument in words.
 */
export function ProblemSection() {
  const reduce = useReducedMotion();

  return (
    <section id="problem" aria-label="The problem" className="relative bg-background py-28 md:py-44">
      <div className="mx-auto w-full max-w-[78rem] px-6 md:px-10">
        <p className="type-eyebrow mb-10 flex items-center gap-3">
          <span className="tabular-nums opacity-70">03</span>
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
          <p className="type-lead text-pretty text-muted-foreground">
            It isn&apos;t a demand problem. Shoppers want the piece. They just can&apos;t tell whether it will look like
            that on them — so they hedge, they over-order, or they leave.
          </p>
        </Reveal>

        <div className="mt-24 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-border md:grid-cols-3">
          {frictions.map((item, i) => (
            <motion.div
              key={item.stat}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="group relative bg-background p-8 transition-colors duration-700 hover:bg-secondary/50 md:p-10"
            >
              <span className="type-eyebrow text-muted-foreground/50">0{i + 1}</span>
              <p className="type-title mt-6">{item.stat}</p>
              <p className="type-body mt-4 text-muted-foreground">{item.body}</p>
              <span className="absolute bottom-0 left-0 h-px w-0 bg-foreground/50 transition-[width] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-full" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
