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
    title: "Add your product",
    body: "Start with a product image from your catalogue. Clothing, footwear, eyewear, jewellery and accessories can become the starting point for new AI-powered fashion experiences.",
  },
  {
    index: "02",
    title: "Choose an experience",
    body: "Select a person, model or creative workflow. Create a virtual try-on, build a complete look, generate an AI model, produce product photography, create a photoshoot or bring fashion content into motion.",
  },
  {
    index: "03",
    title: "Generate and create",
    body: "TryVerse transforms your product into a new visual experience. Generate high-quality fashion imagery and creative assets, then save, reuse and build on your creations across the platform.",
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
            From product <em className="font-normal italic">to possibility</em>.
          </>
        }
        lead="TryVerse gives fashion products a foundation for multiple AI-powered experiences. Upload once, select what you want to create, and generate new visual outcomes from the same product."
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
