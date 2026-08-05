import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Eyebrow } from "@/components/layout/Section";
import { Reveal, RevealLines } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

const plates = [
  {
    ...campaign.crowd,
    caption: "One still figure, the room moving around her",
    meta: "Campaign 01 — Stillness",
  },
  {
    ...campaign.transit,
    caption: "Outerwear, read at speed",
    meta: "Campaign 02 — Transit",
  },
  {
    ...campaign.seatedTrio,
    caption: "Three fits, one empty seat",
    meta: "Campaign 03 — Ensemble",
  },
  {
    ...campaign.crossing,
    caption: "Tailoring in motion, shutter as backdrop",
    meta: "Campaign 04 — Crossing",
  },
  {
    ...campaign.street,
    caption: "The pause before the decision",
    meta: "Campaign 05 — Traffic",
  },
];

/**
 * Horizontal editorial gallery. The page pins while the campaign strip travels sideways —
 * a magazine spread that turns itself. Falls back to a vertical stack on touch/reduced motion.
 */
export function CampaignGallerySection() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-66%"]);

  return (
    <section
      id="campaign"
      aria-label="TryVerse campaign gallery"
      className="relative bg-[hsl(var(--ink))] text-[hsl(40_16%_95%)]"
    >
      <div className="mx-auto w-full max-w-[78rem] px-6 pt-28 md:px-10 md:pt-40">
        <Eyebrow index="05" className="mb-8 text-[hsl(40_16%_95%/0.55)]">
          The campaign
        </Eyebrow>
        <h2 className="type-display max-w-3xl text-balance">
          <RevealLines
            lines={[
              <>Photography is the</>,
              <>
                <em className="font-normal italic">product</em>. We keep it intact.
              </>,
            ]}
          />
        </h2>
        <Reveal delay={0.15} className="mt-8 max-w-xl">
          <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.62)]">
            Fashion is sold on the image. TryVerse renders into that same register — campaign light, campaign
            grade, campaign fidelity — so a try-on never looks like a downgrade of your art direction.
          </p>
        </Reveal>
      </div>

      {/* Desktop: pinned horizontal travel */}
      <div ref={ref} className="relative hidden h-[320vh] lg:block">
        <div className="sticky top-0 flex h-screen items-center overflow-hidden">
          <motion.div
            style={{ x: reduce ? "0%" : x }}
            className="flex gap-8 pl-[max(1.5rem,calc((100vw-78rem)/2+2.5rem))] pr-24 will-change-transform"
          >
            {plates.map((plate) => (
              <figure key={plate.meta} className="group w-[clamp(20rem,30vw,30rem)] shrink-0">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-xl)] border border-[hsl(40_16%_95%/0.14)]">
                  <img
                    src={plate.src}
                    alt={plate.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[hsl(var(--ink))]/10 transition-opacity duration-700 group-hover:opacity-0" />
                </div>
                <figcaption className="mt-5 flex items-baseline justify-between gap-6 border-t border-[hsl(40_16%_95%/0.14)] pt-4">
                  <span className="type-body text-[hsl(40_16%_95%/0.85)]">{plate.caption}</span>
                  <span className="type-eyebrow shrink-0 text-[hsl(40_16%_95%/0.45)]">{plate.meta}</span>
                </figcaption>
              </figure>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Mobile / tablet: swipeable rail, same material */}
      <div className="lg:hidden">
        <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 py-14 [scrollbar-width:none] md:px-10 [&::-webkit-scrollbar]:hidden">
          {plates.map((plate) => (
            <figure key={plate.meta} className="w-[78vw] shrink-0 snap-center sm:w-[52vw]">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(40_16%_95%/0.14)]">
                <img
                  src={plate.src}
                  alt={plate.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="mt-4 border-t border-[hsl(40_16%_95%/0.14)] pt-3">
                <span className="type-body block text-[hsl(40_16%_95%/0.85)]">{plate.caption}</span>
                <span className="type-eyebrow mt-1 block text-[hsl(40_16%_95%/0.45)]">{plate.meta}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
