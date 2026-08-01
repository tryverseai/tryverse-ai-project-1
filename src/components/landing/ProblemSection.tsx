import { Section, Eyebrow } from "@/components/layout/Section";
import { Reveal, RevealGroup, RevealItem, RevealLines } from "@/components/motion/Reveal";

const frictions = [
  {
    stat: "Guesswork",
    body: "A flat product photo on a studio model tells a shopper almost nothing about how a garment will sit on their own frame.",
  },
  {
    stat: "Hesitation",
    body: "Uncertainty stalls the checkout. Carts get abandoned at the exact moment a shopper is closest to buying.",
  },
  {
    stat: "Returns",
    body: "When the only way to find out is to order it, the fitting room moves into the customer's hallway — and back into your warehouse.",
  },
];

/** Act one of the story: name the problem before selling the fix. */
export function ProblemSection() {
  return (
    <Section id="problem" tone="ink" rhythm="wide">
      <Eyebrow index="01" className="mb-10 text-[hsl(40_16%_95%/0.6)]">
        The problem
      </Eyebrow>

      <h2 className="type-display max-w-4xl text-balance">
        <RevealLines
          lines={[
            <>Online shopping still has</>,
            <>
              a <em className="font-normal italic">fitting room</em> problem.
            </>,
          ]}
        />
      </h2>

      <Reveal delay={0.15} className="mt-8 max-w-2xl">
        <p className="type-lead text-pretty text-[hsl(40_16%_95%/0.65)]">
          It isn&apos;t a demand problem. Shoppers want the piece. They just can&apos;t tell whether it will look like
          that on them — so they hedge, they over-order, or they leave.
        </p>
      </Reveal>

      <RevealGroup className="mt-20 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[hsl(40_16%_95%/0.14)] md:grid-cols-3">
        {frictions.map((item) => (
          <RevealItem
            key={item.stat}
            className="bg-[hsl(var(--ink))] p-8 transition-colors duration-500 hover:bg-[hsl(40_16%_95%/0.04)] md:p-10"
          >
            <p className="type-heading text-[hsl(40_16%_95%)]">{item.stat}</p>
            <p className="type-body mt-4 text-[hsl(40_16%_95%/0.6)]">{item.body}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </Section>
  );
}
