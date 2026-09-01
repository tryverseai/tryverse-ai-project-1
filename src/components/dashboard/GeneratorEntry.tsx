import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface GeneratorEntryAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Defaults to filled/primary for the first action, outline-on-ink for the rest. */
  variant?: "primary" | "onInk";
}

interface GeneratorEntryProps {
  title: string;
  subtitle: string;
  actions: GeneratorEntryAction[];
}

/**
 * One editorial landing beat, shared by every full-screen generator (Personal Studio, AI
 * Photoshoot, AI Video, Outfit Builder) instead of each hand-rolling its own dark hero. Generalized
 * from Personal Studio's original `StudioEntry` — see that file for the thin per-feature wrapper
 * that keeps Personal Studio's own copy unchanged.
 */
export function GeneratorEntry({ title, subtitle, actions }: GeneratorEntryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-[hsl(var(--ink))] px-6 py-16 text-center sm:py-24"
    >
      <div className="relative mx-auto max-w-md space-y-6">
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl text-balance">
          {title}
        </h2>
        <p className="text-sm text-white/60 sm:text-base">{subtitle}</p>
        <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
          {actions.map((action, i) => {
            const Icon = action.icon;
            const variant = action.variant ?? (i === 0 ? "primary" : "onInk");
            return (
              <Button
                key={action.label}
                size="lg"
                variant={variant === "onInk" ? "onInk" : undefined}
                className={
                  variant === "primary"
                    ? "w-full gap-2 rounded-full gradient-primary text-primary-foreground shadow-soft sm:w-auto"
                    : "w-full gap-2 rounded-full sm:w-auto"
                }
                onClick={action.onClick}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
