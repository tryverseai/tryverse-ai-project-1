import { Section, SectionIntro } from "@/components/layout/Section";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import {
  Eye,
  ScanFace,
  Sparkles,
  Layers,
  Camera,
  Wand2,
  Image,
  Video,
  Code2,
  BrainCircuit,
  Workflow,
  Library,
  BarChart3,
  Users,
} from "lucide-react";

const beats = [
  {
    index: "a",
    title: "Fashion experiences",
    items: [
      { icon: Eye, label: "Virtual try-on" },
      { icon: Layers, label: "Complete looks" },
      { icon: Sparkles, label: "AI styling" },
      { icon: ScanFace, label: "Personalized visualization" },
    ],
  },
  {
    index: "b",
    title: "AI content creation",
    items: [
      { icon: Wand2, label: "AI models" },
      { icon: Camera, label: "Product photography" },
      { icon: Image, label: "AI photoshoots" },
      { icon: Video, label: "Fashion video" },
    ],
  },
  {
    index: "c",
    title: "The infrastructure layer",
    items: [
      { icon: BrainCircuit, label: "Product intelligence" },
      { icon: Workflow, label: "AI generation workflows" },
      { icon: Library, label: "Creation library" },
      { icon: Code2, label: "APIs & integrations" },
      { icon: BarChart3, label: "Analytics & usage" },
      { icon: Users, label: "Teams & enterprise controls" },
    ],
  },
];

/**
 * Act five: the platform behind the render, paced as its own sequence of beats rather than
 * one grid landing all at once — each category gets room to register on its own before the
 * next arrives. Type-led throughout — there's no real generated output yet for
 * content-creation capabilities (no live FASHN subscription), so this doesn't fabricate
 * screenshots for any of the beats. Reads Experience Layer -> Creation Layer -> Infrastructure
 * Layer top to bottom, infrastructure last so it lands as the foundation, not just another card.
 */
export function PlatformSection() {
  return (
    <Section id="platform" tone="ink" rhythm="wide" ariaLabel="AI fashion infrastructure">
      <SectionIntro
        eyebrow="AI fashion infrastructure"
        index="05"
        title={
          <>
            One product can power <em className="font-normal italic">an entire creative system.</em>
          </>
        }
        lead="A single AI render is an output. TryVerse is the infrastructure behind what comes next."
        className="[&_h2]:text-[hsl(40_16%_95%)] [&_p]:text-[hsl(40_16%_95%/0.65)]"
      />
      <Reveal delay={0.16} className="mt-6 max-w-2xl">
        <p className="type-body text-pretty text-[hsl(40_16%_95%/0.65)]">
          Bring fashion products into one platform and turn them into multiple AI-powered experiences — from virtual
          try-on and complete looks to AI models, product photography, photoshoots and video. Built for more than a
          single generation or one-off experience, TryVerse gives fashion teams a unified system to create, generate,
          manage and scale fashion content and experiences from the same underlying product assets.
        </p>
      </Reveal>
      <Reveal delay={0.24} className="mt-5 max-w-2xl">
        <p className="type-title text-balance text-[hsl(40_16%_95%)]">
          One platform. Multiple creative possibilities. Built to scale.
        </p>
      </Reveal>

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
