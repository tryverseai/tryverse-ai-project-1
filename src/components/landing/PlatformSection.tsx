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
import showcase01 from "@/assets/showcase-01-sweater.jpg";

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
 * next arrives. Only "Shopper experiences" carries a photograph: a real result already shown
 * in the carousel above, brought back small as a callback, not new evidence. The other two
 * beats stay type-led — there's no real generated output yet for content-creation capabilities
 * (no live FASHN subscription), so this doesn't fabricate screenshots for them.
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
            <div className={beat.index === "a" ? "grid gap-10 md:grid-cols-[1fr_auto] md:items-center md:gap-16" : undefined}>
              <div>
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
              </div>

              {beat.index === "a" ? (
                <div className="h-40 w-32 flex-shrink-0 overflow-hidden rounded-2xl sm:h-48 sm:w-40">
                  <img
                    src={showcase01}
                    alt="A real TryVerse virtual try-on result, shown in full above"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
