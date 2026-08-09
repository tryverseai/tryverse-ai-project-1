import { Section, SectionIntro } from "@/components/layout/Section";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { Eye, Ruler, Camera, Video, BarChart3, ShieldCheck } from "lucide-react";

const capabilities = [
  {
    icon: Eye,
    title: "Virtual try-on",
    body: "Photorealistic garment rendering on the shopper's own photo, returned to your product page.",
  },
  {
    icon: Ruler,
    title: "Fit intelligence",
    body: "Body proportions read from the photo inform a size suggestion alongside the render.",
  },
  {
    icon: Camera,
    title: "AI campaign stills",
    body: "Generate model and catalogue imagery from flat product shots, without booking a studio.",
  },
  {
    icon: Video,
    title: "Product motion",
    body: "Turn stills into short editorial loops for PDPs, ads and social placements.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Try-on volume, conversion signals and per-product engagement in your dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise controls",
    body: "Team roles, API keys, domain allow-lists, rate limits and an audit trail.",
  },
];

/** Act five: the platform behind the render. */
export function PlatformSection() {
  return (
    <Section id="platform" tone="ink" rhythm="wide">
      <SectionIntro
        eyebrow="Enterprise platform"
        index="07"
        title={
          <>
            One render is a demo. <em className="font-normal italic">A platform</em> is a business.
          </>
        }
        lead="Everything a fashion team needs to run try-on in production — not a single endpoint bolted onto a storefront."
        className="[&_h2]:text-[hsl(40_16%_95%)] [&_p]:text-[hsl(40_16%_95%/0.65)]"
      />

      <RevealGroup className="mt-20 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[hsl(40_16%_95%/0.14)] sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((c) => (
          <RevealItem
            key={c.title}
            className="group bg-[hsl(var(--ink))] p-8 transition-colors duration-500 hover:bg-[hsl(40_16%_95%/0.05)] md:p-10"
          >
            <c.icon
              className="h-5 w-5 text-[hsl(40_16%_95%/0.7)] transition-transform duration-500 group-hover:-translate-y-0.5"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <p className="type-heading mt-6 text-[hsl(40_16%_95%)]">{c.title}</p>
            <p className="type-body mt-3 text-[hsl(40_16%_95%/0.6)]">{c.body}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
