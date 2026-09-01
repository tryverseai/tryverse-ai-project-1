import { Section, SectionIntro } from "@/components/layout/Section";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import {
  Eye,
  Ruler,
  Sparkles,
  Layers,
  Camera,
  Wand2,
  Image,
  Video,
  Code2,
  Package,
  BarChart3,
  ShieldCheck,
  Gauge,
  Users,
} from "lucide-react";

const beats = [
  {
    index: "a",
    title: "Shopper experiences",
    items: [
      { icon: Eye, label: "Virtual try-on" },
      { icon: Layers, label: "Outfit visualization" },
      { icon: Ruler, label: "Fit intelligence" },
      { icon: Sparkles, label: "AI styling" },
    ],
  },
  {
    index: "b",
    title: "Content creation",
    items: [
      { icon: Camera, label: "AI model photography" },
      { icon: Wand2, label: "Product-to-model generation" },
      { icon: Image, label: "Campaign assets" },
      { icon: Video, label: "Product motion" },
    ],
  },
  {
    index: "c",
    title: "Infrastructure",
    items: [
      { icon: Code2, label: "APIs" },
      { icon: Package, label: "SDKs" },
      { icon: BarChart3, label: "Analytics" },
      { icon: ShieldCheck, label: "Enterprise controls" },
      { icon: Gauge, label: "Rate limits" },
      { icon: Users, label: "Team management" },
    ],
  },
];

/**
 * Act five: the platform behind the render, paced as its own sequence of beats rather than
 * one grid landing all at once — each category gets room to register on its own before the
 * next arrives. Type-led throughout — there's no real generated output yet for
 * content-creation capabilities (no live FASHN subscription), so this doesn't fabricate
 * screenshots for any of the beats.
 */
export function PlatformSection() {
  return (
    <Section id="platform" tone="ink" rhythm="wide">
      <SectionIntro
        eyebrow="Fashion visualization platform"
        index="05"
        title={
          <>
            One render is a demo. <em className="font-normal italic">A platform</em> is a business.
          </>
        }
        lead="Everything a fashion team needs to run visualization in production — shopper experiences, content creation, and the infrastructure underneath, not a single endpoint bolted onto a storefront."
        className="[&_h2]:text-[hsl(40_16%_95%)] [&_p]:text-[hsl(40_16%_95%/0.65)]"
      />

      <div className="mt-20 divide-y divide-[hsl(40_16%_95%/0.12)] border-y border-[hsl(40_16%_95%/0.12)]">
        {beats.map((beat) => (
          <Reveal key={beat.title} as="div" className="py-14 first:pt-0 last:pb-0 md:py-16">
            <p className="type-eyebrow text-[hsl(40_16%_95%/0.45)]">{beat.title}</p>
            <RevealGroup className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {beat.items.map((item) => (
                <RevealItem key={item.label}>
                  <div className="group flex items-center gap-3">
                    <item.icon
                      className="h-4 w-4 flex-shrink-0 text-[hsl(40_16%_95%/0.55)] transition-transform duration-500 group-hover:-translate-y-0.5"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                    <span className="type-body text-[hsl(40_16%_95%/0.85)]">{item.label}</span>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
