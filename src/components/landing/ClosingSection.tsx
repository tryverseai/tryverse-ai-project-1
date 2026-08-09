import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Final beat: no photograph — the crowd frame now opens the page as the hero.
 * A pure black field and the wordmark itself close it out. Brand, not imagery.
 */
export function ClosingSection() {
  return (
    <section
      aria-label="Get started with TryVerse"
      className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[hsl(var(--ink))] px-6 py-24 text-center md:px-10"
    >
      <p className="type-eyebrow mb-8 text-[hsl(40_16%_95%/0.55)]">Get started</p>

      <h2
        className="select-none text-balance font-display font-normal leading-[0.9] tracking-[-0.03em] text-[hsl(40_16%_95%)]"
        style={{ fontSize: "clamp(3.5rem, 13vw, 10rem)" }}
      >
        TryVerse
      </h2>

      <Reveal delay={0.15} className="mt-8 max-w-xl">
        <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.72)]">
          AI virtual try-on infrastructure for fashion commerce. Create a brand account and run your first try-ons
          on your own catalogue.
        </p>
      </Reveal>

      <Reveal delay={0.26} className="mt-10">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/auth?signup=business" className="w-full sm:w-auto">
            <Button size="xl" variant="contrast" className="group w-full sm:w-auto">
              Start free
              <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Button>
          </Link>
          <Link to="/book-demo" className="w-full sm:w-auto">
            <Button size="xl" variant="onInk" className="w-full sm:w-auto">
              Book a demo
            </Button>
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

