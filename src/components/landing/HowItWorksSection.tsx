import { Section, SectionIntro } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { AutoPlayVideo } from "@/components/AutoPlayVideo";
import heroVideo2 from "@/assets/hero-video-2.mp4";
import heroModel2 from "@/assets/hero-model-2.jpg";
import heroVideo3 from "@/assets/hero-video-3.mp4";
import heroModel3 from "@/assets/hero-model-3.jpg";
import heroVideo4 from "@/assets/hero-video-4.mp4";
import heroModel4 from "@/assets/hero-model-4.jpg";

const steps = [
  {
    index: "01",
    title: "Pick your style",
    body: "The shopper chooses a piece from your catalogue. Nothing about your product data or merchandising changes.",
    video: heroVideo2,
    poster: heroModel2,
  },
  {
    index: "02",
    title: "Snap or upload a photo",
    body: "One clear photo from a phone camera or camera roll. No scanning rig, no measuring tape, no account required.",
    video: heroVideo3,
    poster: heroModel3,
  },
  {
    index: "03",
    title: "See it on you",
    body: "TryVerse renders the garment onto their body and returns the result in the same session, on the same page.",
    video: heroVideo4,
    poster: heroModel4,
  },
];

/** Act two: the mechanic, one step per row with alternating alignment for rhythm. */
export function HowItWorksSection() {
  return (
    <Section id="how-it-works" rhythm="wide">
      <SectionIntro
        eyebrow="How it works"
        index="02"
        title={
          <>
            Three steps between{" "}
            <em className="font-normal italic">curiosity</em> and confidence.
          </>
        }
        lead="No avatars, no approximations, no separate app to download. The whole flow happens where the shopper already is."
      />

      <ol className="mt-20 space-y-20 md:space-y-28">
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

              <Reveal delay={0.1} y={30}>
                <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border studio-frame shadow-[var(--shadow-card)] lift">
                  <div className="aspect-[4/5] md:aspect-[5/6]">
                    <AutoPlayVideo src={step.video} poster={step.poster} className="h-full w-full object-cover" />
                  </div>
                </div>
              </Reveal>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
