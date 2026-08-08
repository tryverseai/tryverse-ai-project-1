import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Eyebrow } from "@/components/layout/Section";
import { Reveal, RevealGroup, RevealItem, RevealLines } from "@/components/motion/Reveal";
import { MaskedImage } from "@/components/motion/ParallaxImage";
import { campaign } from "@/lib/campaignImagery";

const stages = [
  {
    index: "01",
    term: "Garment, isolated",
    body: "The flat or on-mannequin shot is parsed into a garment layer — cut, seams, print placement, drape behaviour.",
  },
  {
    index: "02",
    term: "Body, understood",
    body: "Pose, proportion and depth are read from a single photo. No rig, no depth camera, no measurements.",
  },
  {
    index: "03",
    term: "Render, composited",
    body: "The garment is rebuilt on the body under the original light, and the shopper's identity is returned untouched.",
  },
];

/**
 * The invisible-mannequin beat: literally shows how the pipeline sees a garment
 * before it ever reaches a person. Steps advance against a pinned campaign plate.
 */
export function MannequinSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["6%", "-6%"]);

  return (
    <section id="pipeline" aria-label="How TryVerse renders a garment" className="relative overflow-hidden bg-background py-24 md:py-36">
      <div className="mx-auto grid w-full max-w-[78rem] grid-cols-1 gap-14 px-6 md:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-20">
        <div ref={ref} className="relative order-2 lg:order-1">
          <motion.div style={{ y }} className="relative">
            <MaskedImage
              src={campaign.mannequins.src}
              alt={campaign.mannequins.alt}
              className="aspect-[4/5] rounded-[var(--radius-xl)] studio-frame"
              imgClassName="object-contain p-4"
            />
            {/* Measurement hairlines — the pipeline made visible, not illustrated with icons. */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              {[28, 52, 76].map((top, i) => (
                <motion.span
                  key={top}
                  className="absolute left-0 right-0 h-px bg-foreground/12"
                  style={{ top: `${top}%` }}
                  initial={reduce ? { opacity: 0 } : { scaleX: 0, opacity: 0 }}
                  whileInView={{ scaleX: 1, opacity: 1 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{ duration: 1.1, delay: 0.5 + i * 0.14, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
            </div>
            <span className="absolute bottom-5 left-5 rounded-[var(--radius-pill)] bg-background/85 px-3 py-1.5 type-eyebrow backdrop-blur-sm">
              Garment layer · isolated
            </span>
          </motion.div>
        </div>

        <div className="order-1 lg:order-2">
          <Eyebrow index="05" className="mb-8">
            The workflow
          </Eyebrow>
          <h2 className="type-display max-w-2xl text-balance">
            <RevealLines
              lines={[
                <>Before it reaches</>,
                <>
                  a person, it becomes <em className="font-normal italic">form</em>.
                </>,
              ]}
            />
          </h2>
          <Reveal delay={0.15} className="mt-8 max-w-lg">
            <p className="type-lead text-pretty">
              TryVerse treats a garment as geometry and material before it treats it as an image. That is why the
              render holds its shape on a body it has never seen.
            </p>
          </Reveal>

          <RevealGroup className="mt-12 divide-y divide-border border-y border-border">
            {stages.map((stage) => (
              <RevealItem key={stage.index}>
                <div className="group grid grid-cols-[auto_1fr] gap-6 py-7 transition-colors duration-500 hover:bg-secondary/50">
                  <span className="type-eyebrow pt-1 tabular-nums text-muted-foreground/70">{stage.index}</span>
                  <div>
                    <p className="type-heading">{stage.term}</p>
                    <p className="type-body mt-2 max-w-md text-muted-foreground">{stage.body}</p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
