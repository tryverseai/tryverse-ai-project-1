import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Section, SectionIntro } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import loop2 from "@/assets/loop-2.mp4";
import loop2Poster from "@/assets/loop-2-poster.jpg";
import loop3 from "@/assets/loop-3.mp4";
import loop3Poster from "@/assets/loop-3-poster.jpg";
import loop4 from "@/assets/loop-4.mp4";
import loop4Poster from "@/assets/loop-4-poster.jpg";

const steps = [
  {
    index: "01",
    title: "Pick your style",
    body: "The shopper chooses a piece from your catalogue. Nothing about your product data or merchandising changes.",
    video: loop2,
    poster: loop2Poster,
  },
  {
    index: "02",
    title: "Snap or upload a photo",
    body: "One clear photo from a phone camera or camera roll. No scanning rig, no measuring tape, no account required.",
    video: loop3,
    poster: loop3Poster,
  },
  {
    index: "03",
    title: "See it on you",
    body: "TryVerse renders the garment onto their body and returns the result in the same session, on the same page.",
    video: loop4,
    poster: loop4Poster,
  },
];

/** One step per row, alternating alignment, each film card drifting on scroll. */
function StepMedia({ src, poster, flip }: { src: string; poster: string; flip: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : [flip ? "6%" : "8%", flip ? "-6%" : "-8%"]);

  return (
    <div ref={ref}>
      <motion.div
        style={{ y }}
        className="overflow-hidden rounded-[var(--radius-xl)] border border-border studio-frame shadow-[var(--shadow-card)] lift"
      >
        <div className="aspect-[4/5] md:aspect-[5/6]">
          <AutoPlayVideo src={src} poster={poster} className="h-full w-full object-cover" />
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

              <StepMedia src={step.video} poster={step.poster} flip={i % 2 === 1} />
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
