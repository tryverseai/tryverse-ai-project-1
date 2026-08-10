import { Section, SectionIntro } from "@/components/layout/Section";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { ParallaxImage } from "@/components/motion/ParallaxImage";
import referencePhoto from "@/assets/how-it-works-model.jpg";
import productPhoto from "@/assets/how-it-works-product-only.jpg";

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
    <Section id="how-it-works" rhythm="wide">
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

      <RevealGroup className="mt-16 divide-y divide-border border-y border-border md:mt-20">
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

      {/* The demo, not a diagram of it — a real reference photo and a real product upload, inside TryVerse itself. */}
      <div className="mt-16 grid grid-cols-2 gap-3 md:mt-24 md:gap-4">
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border studio-frame shadow-[var(--shadow-card)]">
          <ParallaxImage
            src={referencePhoto}
            alt="A shopper's reference photo uploaded to TryVerse"
            className="aspect-[3/4] bg-secondary"
            distance={5}
            scaleFrom={1.06}
          />
        </div>
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border studio-frame shadow-[var(--shadow-card)]">
          <ParallaxImage
            src={productPhoto}
            alt="A product uploaded to TryVerse, ready for try-on"
            className="aspect-[3/4] bg-secondary"
            distance={5}
            scaleFrom={1.06}
          />
        </div>
      </div>
    </Section>
  );
}
