import { Section, SectionIntro } from "@/components/layout/Section";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { BeforeAfter } from "@/components/BeforeAfter";
import femaleBefore from "@/assets/demo-female-before.jpg";
import femaleAfter from "@/assets/demo-female-after.jpg";
import maleBefore from "@/assets/demo-male-before.jpg";
import maleAfter from "@/assets/demo-male-after.jpg";

const traits = [
  { term: "Garment fidelity", detail: "Cut, drape, print and seam placement are preserved, not approximated." },
  { term: "Identity preserved", detail: "The shopper's face, hair and proportions stay theirs throughout the render." },
  { term: "Session-speed", detail: "Results return inside the same browsing session, on the same page." },
];

/** Act four: show the output, don't describe it. */
export function TryOnProofSection() {
  return (
    <Section id="try-on" tone="studio" rhythm="wide">
      <SectionIntro
        eyebrow="AI virtual try-on"
        index="04"
        title={
          <>
            The render is the <em className="font-normal italic">argument</em>.
          </>
        }
        lead="Drag to compare. Same person, same light, same photo — the garment is the only thing that changed."
      />

      <div className="mt-16 grid gap-8 md:grid-cols-2 md:gap-10">
        <Reveal>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card shadow-[var(--shadow-card)]">
            <BeforeAfter beforeSrc={femaleBefore} afterSrc={femaleAfter} />
            <p className="type-caption border-t border-border px-5 py-4">Womenswear · full-body render</p>
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card shadow-[var(--shadow-card)]">
            <BeforeAfter beforeSrc={maleBefore} afterSrc={maleAfter} />
            <p className="type-caption border-t border-border px-5 py-4">Menswear · upper-body render</p>
          </div>
        </Reveal>
      </div>

      <RevealGroup className="mt-16 grid gap-10 border-t border-border pt-10 md:grid-cols-3">
        {traits.map((t) => (
          <RevealItem key={t.term}>
            <p className="type-heading">{t.term}</p>
            <p className="type-body mt-3 text-muted-foreground">{t.detail}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
