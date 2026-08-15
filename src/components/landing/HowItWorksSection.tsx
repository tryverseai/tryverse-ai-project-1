import { Section, SectionIntro } from "@/components/layout/Section";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { VoyagerShowcase } from "@/components/landing/VoyagerShowcase";
import showcase01 from "@/assets/showcase-01-sweater.jpg";
import showcase02 from "@/assets/showcase-02-dress.jpg";
import showcase03 from "@/assets/showcase-03-polo.jpg";
import showcase04 from "@/assets/showcase-04-traditional.jpg";
import showcase05 from "@/assets/showcase-05-yellow-shirt.jpg";
import showcase06 from "@/assets/showcase-06-navy.jpg";

const showcaseSlides = [
  { src: showcase01, alt: "TryVerse try-on demo: reference photo, cream sweater, and result" },
  { src: showcase02, alt: "TryVerse try-on demo: reference photo, burgundy dress, and result" },
  { src: showcase03, alt: "TryVerse try-on demo: reference photo, black polo, and result" },
  { src: showcase04, alt: "TryVerse try-on demo: reference photo, traditional outfit, and result" },
  { src: showcase05, alt: "TryVerse try-on demo: reference photo, yellow shirt, and result" },
  { src: showcase06, alt: "TryVerse try-on demo: reference photo, navy garment, and result" },
];

const steps = [
  {
    index: "01",
    title: "Pick your style",
    body: "The shopper chooses a piece from your catalogue. Nothing about your product data or merchandising changes.",
  },
  {
    index: "02",
    title: "Snap or upload a photo",
    body: "One clear photo from a phone camera or camera roll. No scanning rig, no measuring tape, no account required.",
  },
  {
    index: "03",
    title: "See it on you",
    body: "TryVerse renders the garment onto their body and returns the result in the same session, on the same page.",
  },
];

export function HowItWorksSection() {
  return (
    <Section id="how-it-works" rhythm="normal">
      <SectionIntro
        eyebrow="How it works"
        index="04"
        title={
          <>
            Three steps between <em className="font-normal italic">curiosity</em> and confidence.
          </>
        }
        lead="No avatars, no approximations, no separate app to download. The whole flow happens where the shopper already is."
      />

      <RevealGroup className="mt-12 divide-y divide-border border-y border-border md:mt-16">
        {steps.map((step) => (
          <RevealItem key={step.index}>
            <div className="grid grid-cols-[auto_1fr] gap-6 py-7 md:py-9">
              <span className="type-eyebrow pt-1 tabular-nums text-muted-foreground/70">{step.index}</span>
              <div>
                <p className="type-heading">{step.title}</p>
                <p className="type-body mt-2 max-w-md text-muted-foreground">{step.body}</p>
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      {/* The demo, not a diagram of it — six real TryVerse sessions, scroll-scrubbed. No video, no arrows. */}
      <div className="mt-10 md:mt-14">
        <VoyagerShowcase slides={showcaseSlides} />
      </div>
    </Section>
  );
}
