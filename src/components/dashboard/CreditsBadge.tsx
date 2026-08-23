import { Zap } from "lucide-react";
import { useCredits } from "@/contexts/CreditsContext";

interface CreditsBadgeProps {
  onClick?: () => void;
  className?: string;
}

/** Persistent account-level credit balance — reads from the real backend `/api/credits` via CreditsContext, never hardcoded. */
export function CreditsBadge({ onClick, className }: CreditsBadgeProps) {
  const { balance, isUnlimited, loading } = useCredits();

  const label = loading ? "…" : isUnlimited ? "Unlimited" : `${balance ?? 0} Credits`;

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
