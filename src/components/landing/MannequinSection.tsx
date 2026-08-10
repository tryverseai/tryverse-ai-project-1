import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Eyebrow } from "@/components/layout/Section";
import { Reveal, RevealGroup, RevealItem, RevealLines } from "@/components/motion/Reveal";
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
 * Act four: the workflow, told in words first — then the photograph runs full width
 * below it, same rhythm as "Why it matters" (type sets up the idea, the image then
 * takes the section over edge to edge, no card, no border).
 */
export function MannequinSection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-9%", "9%"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.1, 1]);

  return (
    <section id="pipeline" aria-label="How TryVerse renders a garment" className="relative overflow-hidden bg-background py-24 md:py-36">
      <div className="mx-auto w-full max-w-[78rem] px-6 md:px-10">
        <Eyebrow index="03" className="mb-8">
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

      {/* The photograph carries the rest of the section — full width, no card, no border. */}
      <div ref={ref} className="relative mt-16 overflow-hidden md:mt-24">
        <div className="aspect-[4/5] sm:aspect-[16/10] lg:aspect-[21/9]">
          <motion.img
            src={campaign.sofa.src}
            alt={campaign.sofa.alt}
            loading="lazy"
            decoding="async"
            style={{ y, scale }}
            className="h-full w-full object-cover will-change-transform"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
