import { ChevronLeft } from "lucide-react";

export function BackLink({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1"
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
