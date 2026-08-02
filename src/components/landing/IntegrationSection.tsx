import { Section, SectionIntro } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";

const routes = [
  {
    index: "A",
    title: "Popup widget",
    body: "A single script tag on your storefront. Try-on opens over your product page, styled to your brand.",
    detail: "Fastest path to live",
  },
  {
    index: "B",
    title: "Embedded component",
    body: "Render try-on inline inside your PDP layout, positioned exactly where your team wants it.",
    detail: "Full layout control",
  },
  {
    index: "C",
    title: "Direct API",
    body: "Call the try-on endpoint from your own backend and own the entire experience end to end.",
    detail: "For in-house platforms",
  },
];

/** Act six: how a brand actually adopts it. No logo wall — the routes are the story. */
export function IntegrationSection() {
  return (
    <Section id="integration" rhythm="wide">
      <SectionIntro
        eyebrow="Brand integration"
        index="06"
        title={
          <>
            Three ways in. <em className="font-normal italic">No replatforming.</em>
          </>
        }
        lead="TryVerse sits beside your commerce stack rather than inside it. Your catalogue, checkout and CMS stay exactly as they are."
      />

      <div className="mt-20 divide-y divide-border border-y border-border">
        {routes.map((route, i) => (
          <Reveal key={route.index} delay={i * 0.08}>
            <div className="group grid gap-6 py-10 transition-colors duration-500 md:grid-cols-[auto_1fr_auto] md:items-baseline md:gap-12 md:py-14">
              <span className="type-mono text-muted-foreground transition-colors duration-500 group-hover:text-foreground">
                {route.index}
              </span>
              <div className="max-w-2xl">
                <h3 className="type-title transition-transform duration-500 group-hover:translate-x-1">
                  {route.title}
                </h3>
                <p className="type-body mt-4 text-muted-foreground text-pretty">{route.body}</p>
              </div>
              <span className="type-caption md:text-right">{route.detail}</span>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1} className="mt-12">
        <p className="type-caption max-w-xl">
          Works alongside hosted and headless storefronts alike — anywhere you can add a script tag or make an HTTPS
          request.
        </p>
      </Reveal>
    </Section>
  );
}
