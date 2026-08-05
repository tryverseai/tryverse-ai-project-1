import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Section, SectionIntro } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";

const stages = [
  {
    step: "Free",
    title: "Test it on your own catalogue",
    body: "Create a brand account and receive try-on credits to run against your real products — no card, no sales call.",
  },
  {
    step: "Activate",
    title: "Choose a plan when you're convinced",
    body: "Plans scale with monthly try-on volume. Full pricing appears in your dashboard the moment you sign in.",
  },
  {
    step: "Scale",
    title: "Enterprise terms for larger catalogues",
    body: "Custom volume, dedicated support and procurement-friendly terms, arranged directly with our team.",
  },
];

/** Act eight: pricing as a journey, kept behind the login per our onboarding model. */
export function PricingSection() {
  return (
    <Section id="pricing" rhythm="wide">
      <SectionIntro
        eyebrow="Pricing"
        index="10"
        title={
          <>
            Try it first. <em className="font-normal italic">Pay when it earns it.</em>
          </>
        }
        lead="We'd rather you evaluate TryVerse on your own products than on a pricing table."
      />

      <div className="mt-20 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-border md:grid-cols-3">
        {stages.map((s, i) => (
          <Reveal key={s.step} delay={i * 0.08}>
            <div className="h-full bg-card p-8 transition-colors duration-500 hover:bg-secondary/50 md:p-10">
              <p className="type-eyebrow">{s.step}</p>
              <h3 className="type-heading mt-6 text-balance">{s.title}</h3>
              <p className="type-body mt-4 text-muted-foreground text-pretty">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.12} className="mt-12">
        <Link to="/auth?signup=business">
          <Button size="xl" variant="outline" className="group">
            Create a brand account
            <ArrowUpRight className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Button>
        </Link>
      </Reveal>
    </Section>
  );
}
