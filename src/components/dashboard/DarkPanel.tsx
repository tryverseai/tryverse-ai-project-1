import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Dark "ink" continuation of GeneratorEntry for steps reached directly from it (e.g. a
 * standalone model picker) — keeps the premium black surface instead of dropping the user
 * back onto the plain white page background between the entry and the next real step.
 */
export function DarkPanel({
  onBack,
  backLabel = "Back to start",
  eyebrow,
  children,
}: {
  onBack: () => void;
  backLabel?: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-[hsl(var(--ink))] p-6 sm:p-8">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1 inline-flex items-center gap-1 text-sm text-white/60 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel}
      </button>
      {eyebrow && <p className="text-sm font-medium text-white/80">{eyebrow}</p>}
      {children}
    </div>
  );
}
