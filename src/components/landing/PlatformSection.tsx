import { Section, SectionIntro } from "@/components/layout/Section";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
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

const categories = [
  {
    title: "Shopper experiences",
    items: [
      { icon: Eye, label: "Virtual try-on" },
      { icon: Layers, label: "Outfit visualization" },
      { icon: Ruler, label: "Fit intelligence" },
      { icon: Sparkles, label: "AI styling" },
    ],
  },
  {
    title: "Content creation",
    items: [
      { icon: Camera, label: "AI model photography" },
      { icon: Wand2, label: "Product-to-model generation" },
      { icon: Image, label: "Campaign assets" },
      { icon: Video, label: "Product motion" },
    ],
  },
  {
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

/** Act five: the platform behind the render. */
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

      <RevealGroup className="mt-20 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[hsl(40_16%_95%/0.14)] sm:grid-cols-3">
        {categories.map((cat) => (
          <RevealItem key={cat.title} className="bg-[hsl(var(--ink))] p-8 md:p-10">
            <p className="type-eyebrow text-[hsl(40_16%_95%/0.45)]">{cat.title}</p>
            <ul className="mt-6 space-y-4">
              {cat.items.map((item) => (
                <li key={item.label} className="group flex items-center gap-3">
                  <item.icon
                    className="h-4 w-4 flex-shrink-0 text-[hsl(40_16%_95%/0.55)] transition-transform duration-500 group-hover:-translate-y-0.5"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="type-body text-[hsl(40_16%_95%/0.85)]">{item.label}</span>
                </li>
              ))}
            </ul>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
