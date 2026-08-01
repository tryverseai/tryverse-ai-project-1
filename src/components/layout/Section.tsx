import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Narrative section shell. `tone` sets the surface, `rhythm` sets vertical pacing —
 * varying these is what stops the page reading as one uniform stack of cards.
 */
export function Section({
  children,
  className,
  id,
  tone = "paper",
  rhythm = "normal",
  bleed = false,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "paper" | "studio" | "ink" | "card";
  rhythm?: "tight" | "normal" | "wide";
  bleed?: boolean;
  ariaLabel?: string;
}) {
  const toneClass = {
    paper: "bg-background text-foreground",
    studio: "studio-frame text-foreground",
    ink: "bg-[hsl(var(--ink))] text-[hsl(40_16%_95%)]",
    card: "bg-card text-card-foreground",
  }[tone];

  const rhythmClass = {
    tight: "py-16 md:py-20",
    normal: "py-24 md:py-32",
    wide: "py-28 md:py-44",
  }[rhythm];

  return (
    <section id={id} aria-label={ariaLabel} className={cn("relative", toneClass, rhythmClass, className)}>
      <div className={cn(bleed ? "w-full" : "mx-auto w-full max-w-[78rem] px-6 md:px-10")}>{children}</div>
    </section>
  );
}

/** Small mono label that sits above a heading. */
export function Eyebrow({
  children,
  className,
  index,
}: {
  children: ReactNode;
  className?: string;
  index?: string;
}) {
  return (
    <p className={cn("type-eyebrow flex items-center gap-3", className)}>
      {index ? <span className="tabular-nums opacity-60">{index}</span> : null}
      <span className="h-px w-6 bg-current opacity-30" aria-hidden="true" />
      {children}
    </p>
  );
}

/** Standard section intro: eyebrow + display heading + optional lead. */
export function SectionIntro({
  eyebrow,
  index,
  title,
  lead,
  align = "left",
  className,
}: {
  eyebrow?: string;
  index?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <Eyebrow index={index} className={cn("mb-6", align === "center" && "justify-center")}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h2 className="type-display text-balance">{title}</h2>
      {lead ? <p className="type-lead mt-6 max-w-2xl text-pretty">{lead}</p> : null}
    </Reveal>
  );
}
