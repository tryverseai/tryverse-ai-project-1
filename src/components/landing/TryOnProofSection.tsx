import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal, RevealGroup, RevealItem, RevealLines } from "@/components/motion/Reveal";
import { BeforeAfter } from "@/components/BeforeAfter";
import { campaign } from "@/lib/campaignImagery";
import femaleBefore from "@/assets/demo-female-before.jpg";
import femaleAfter from "@/assets/demo-female-after.jpg";
import maleBefore from "@/assets/demo-male-before.jpg";
import maleAfter from "@/assets/demo-male-after.jpg";

const traits = [
  { term: "Garment fidelity", detail: "Cut, drape, print and seam placement are preserved, not approximated." },
  { term: "Identity preserved", detail: "The shopper's face, hair and proportions stay theirs throughout the render." },
  { term: "Session-speed", detail: "Results return inside the same browsing session, on the same page." },
];

/**
 * The proof beat — the strongest section on the page.
 * A campaign plate runs behind the type, then the page drops to paper for the comparisons
 * so the renders are read on a clean, gallery-white surface.
 */
export function TryOnProofSection() {
  const reduce = useReducedMotion();
  const bandRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: bandRef, offset: ["start end", "end start"] });
  const bandY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-12%", "12%"]);
  const bandScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.14, 1]);

  return (
    <section id="try-on" aria-label="AI virtual try-on" className="relative bg-background">
      {/* ---- Campaign band: type over photography ---- */}
      <div ref={bandRef} className="relative isolate overflow-hidden bg-[hsl(var(--ink))] text-[hsl(40_16%_95%)]">
        <motion.img
          src={campaign.seatedTrio.src}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ y: bandY, scale: bandScale }}
          className="absolute inset-0 h-full w-full object-cover will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--ink))] via-[hsl(var(--ink))]/78 to-[hsl(var(--ink))]/25" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-[78rem] px-6 py-28 md:px-10 md:py-40">
          <p className="type-eyebrow mb-8 flex items-center gap-3 text-[hsl(40_16%_95%/0.6)]">
            <span className="tabular-nums opacity-70">04</span>
            <span className="h-px w-6 bg-current opacity-40" aria-hidden="true" />
            AI virtual try-on
          </p>
          <h2 className="type-hero max-w-4xl text-balance">
            <RevealLines
              lines={[
                <>The render is</>,
                <>
                  the <em className="font-normal italic">argument</em>.
                </>,
              ]}
            />
          </h2>
          <Reveal delay={0.2} className="mt-10 max-w-xl">
            <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.7)]">
              No claim on this page matters as much as the output. Drag the handle. Same person, same light, same
              photograph — the garment is the only thing that changed.
            </p>
          </Reveal>
        </div>
      </div>

      {/* ---- Gallery-white comparison floor ---- */}
      <div className="studio-frame">
        <div className="mx-auto w-full max-w-[78rem] px-6 py-24 md:px-10 md:py-32">
          <div className="grid gap-10 md:grid-cols-2 md:gap-12">
            {[
              { before: femaleBefore, after: femaleAfter, caption: "Womenswear", meta: "Full-body render · one source photo" },
              { before: maleBefore, after: maleAfter, caption: "Menswear", meta: "Upper-body render · one source photo" },
            ].map((item, i) => (
              <Reveal key={item.caption} delay={i * 0.12}>
                <figure className="group">
                  <BeforeAfter
                    beforeSrc={item.before}
                    afterSrc={item.after}
                    className="shadow-[var(--shadow-elevated)] transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1"
                  />
                  <figcaption className="mt-5 flex items-baseline justify-between gap-6 border-t border-border pt-4">
                    <span className="type-heading">{item.caption}</span>
                    <span className="type-eyebrow shrink-0">{item.meta}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          <RevealGroup className="mt-20 grid gap-10 border-t border-border pt-12 md:grid-cols-3">
            {traits.map((t) => (
              <RevealItem key={t.term}>
                <p className="type-heading">{t.term}</p>
                <p className="type-body mt-3 text-muted-foreground">{t.detail}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
