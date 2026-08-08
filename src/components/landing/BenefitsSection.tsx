import { Section, SectionIntro } from "@/components/layout/Section";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";

const outcomes = [
  {
    audience: "For the shopper",
    points: [
      "Sees the garment on their own body, not a studio model's",
      "Decides in seconds without leaving the product page",
      "No app download, no account, no measuring",
    ],
  },
  {
    audience: "For the brand",
    points: [
      "Fewer size-driven returns entering the warehouse",
      "Richer signal on which products shoppers actually consider",
      "Campaign-grade imagery generated from existing product shots",
    ],
  },
  {
    audience: "For the team",
    points: [
      "Live on a storefront without an engineering project",
      "Roles, keys and domain controls for larger organisations",
      "Usage and credit visibility in one dashboard",
    ],
  },
];

/** Act seven: who gains what. Capability-led, no invented metrics. */
export function BenefitsSection() {
  return (
    <Section id="benefits" tone="studio" rhythm="wide">
      <SectionIntro
        eyebrow="Customer benefits"
        index="08"
        title={
          <>
            What changes the day it goes <em className="font-normal italic">live</em>.
          </>
        }
      />

      <RevealGroup className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
        {outcomes.map((o) => (
          <RevealItem key={o.audience} className="border-t border-foreground/15 pt-8">
            <p className="type-eyebrow mb-6">{o.audience}</p>
            <ul className="space-y-4">
              {o.points.map((p) => (
                <li key={p} className="type-body flex gap-3 text-muted-foreground">
                  <span className="mt-2.5 h-px w-4 shrink-0 bg-foreground/30" aria-hidden="true" />
                  <span className="text-pretty">{p}</span>
                </li>
              ))}
            </ul>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
