import { Zap } from "lucide-react";
import { useCredits } from "@/contexts/CreditsContext";

interface CreditsBadgeProps {
  onClick?: () => void;
  className?: string;
  /** Icon-only rendering for a collapsed sidebar rail — same data, no label text. */
  collapsed?: boolean;
}

/** Persistent account-level credit balance — reads from the real backend `/api/credits` via CreditsContext, never hardcoded. */
export function CreditsBadge({ onClick, className, collapsed = false }: CreditsBadgeProps) {
  const { balance, isUnlimited, loading } = useCredits();

  const label = loading ? "…" : isUnlimited ? "Unlimited" : `${balance ?? 0} Credits`;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Your TryVerse credit balance: ${label}`}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted ${className ?? ""}`}
      >
        <Zap className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Your TryVerse credit balance"
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted ${className ?? ""}`}
    >
      <Zap className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <span className="font-mono tabular-nums">{label}</span>
    </button>
  );
}
