import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Eyebrow } from "@/components/layout/Section";
import { Reveal, RevealGroup, RevealItem, RevealLines } from "@/components/motion/Reveal";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import { campaign } from "@/lib/campaignImagery";
import featuresModelVideo from "@/assets/features-model-video.mp4";

const stages = [
  {
    index: "01",
    term: "Ingest",
    body: "A product enters TryVerse through a simple image or product asset. Its visual identity becomes the foundation for future generation, styling and visualization workflows.",
  },
  {
    index: "02",
    term: "Configure",
    body: "Pair the product with a real person, customer image, AI-generated model or creative direction. Products can also be combined across categories — from clothing and footwear to eyewear, jewellery and accessories.",
  },
  {
    index: "03",
    term: "Generate",
    body: "Turn the same fashion asset into different experiences — virtual try-ons, complete outfits, AI models, product photography, AI photoshoots, fashion video. One product layer. Multiple visual outcomes.",
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
    <section id="pipeline" aria-label="How TryVerse renders a product" className="relative overflow-hidden bg-background py-14 sm:py-20 md:py-36">
      <div className="mx-auto w-full max-w-[78rem] px-6 md:px-10">
        <Eyebrow index="03" className="mb-8">
          The workflow
        </Eyebrow>
        <h2 className="type-display max-w-2xl text-balance">
          <RevealLines
            lines={[
              <>One fashion product.</>,
              <>
                Multiple <em className="font-normal italic">intelligent</em> experiences.
              </>,
            ]}
          />
        </h2>
        <Reveal delay={0.15} className="mt-8 max-w-lg">
          <p className="type-lead text-pretty">
            TryVerse transforms fashion products into infrastructure that can be used across the entire visual
            commerce workflow.
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
          <motion.div style={{ y, scale }} className="h-full w-full will-change-transform">
            <AutoPlayVideo
              src={featuresModelVideo}
              poster={campaign.sofa.src}
              posterAlt={campaign.sofa.alt}
              className="h-full w-full object-cover"
            />
          </motion.div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
