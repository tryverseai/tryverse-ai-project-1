import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Section, SectionIntro } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { campaign } from "@/lib/campaignImagery";

const steps = [
  {
    index: "01",
    title: "Pick your style",
    body: "The shopper chooses a piece from your catalogue. Nothing about your product data or merchandising changes.",
    image: campaign.shirt,
  },
  {
    index: "02",
    title: "Snap or upload a photo",
    body: "One clear photo from a phone camera or camera roll. No scanning rig, no measuring tape, no account required.",
    image: campaign.studio,
  },
  {
    index: "03",
    title: "See it on you",
    body: "TryVerse renders the garment onto their body and returns the result in the same session, on the same page.",
    image: campaign.crossing,
  },
];

/** One step per row, alternating alignment, each campaign plate drifting on scroll. */
function StepMedia({ src, alt, flip }: { src: string; alt: string; flip: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : [flip ? "6%" : "8%", flip ? "-6%" : "-8%"]);

  return (
    <div ref={ref}>
      <motion.div
        style={{ y }}
        className="group overflow-hidden rounded-[var(--radius-xl)] border border-border studio-frame shadow-[var(--shadow-card)] lift"
      >
        <div className="aspect-[4/5] md:aspect-[5/6]">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
          />
        </div>
      </motion.div>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <Section id="how-it-works" rhythm="wide">
      <SectionIntro
        eyebrow="How it works"
        index="03"
        title={
          <>
            Three steps between <em className="font-normal italic">curiosity</em> and confidence.
          </>
        }
        lead="No avatars, no approximations, no separate app to download. The whole flow happens where the shopper already is."
      />

      <ol className="mt-20 space-y-24 md:space-y-36">
        {steps.map((step, i) => (
          <li key={step.index}>
            <div
              className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${
                i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
              }`}
            >
              <Reveal>
                <p className="type-eyebrow mb-6">Step {step.index}</p>
                <h3 className="type-title text-balance">{step.title}</h3>
                <p className="type-lead mt-5 max-w-md text-pretty">{step.body}</p>
              </Reveal>

              <StepMedia src={step.image.src} alt={step.image.alt} flip={i % 2 === 1} />
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
