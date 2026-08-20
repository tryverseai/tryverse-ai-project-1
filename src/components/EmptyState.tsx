import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: { label: string; onClick: () => void };
  className?: string;
}

/** Shared empty-state card — icon, title, optional description and CTA. */
export function EmptyState({ icon: Icon, title, description, cta, className }: EmptyStateProps) {
  return (
    <div className={`text-center py-16 bg-card rounded-xl border border-border/50 ${className ?? ""}`}>
      <div className="w-14 h-14 rounded-full bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
        <Icon className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">{description}</p>
      )}
      {cta && (
        <Button onClick={cta.onClick} variant="outline" size="sm" className="mt-4">
          {cta.label}
        </Button>
      )}
    </div>
  );
}
