import {
  Sun,
  UserSquare2,
  MoveVertical,
  Eye,
  ImageOff,
  Ban,
  Users2,
  Camera,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { posthogCapture } from "@/lib/posthog";

/** localStorage key — shared across dashboard + widget-context users, no schema change needed. */
export const TRYON_GUIDELINES_SEEN_KEY = "tv_seen_tryon_guidelines";

export function hasSeenTryOnGuidelines(): boolean {
  try {
    return localStorage.getItem(TRYON_GUIDELINES_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTryOnGuidelinesSeen(): void {
  try {
    localStorage.setItem(TRYON_GUIDELINES_SEEN_KEY, "1");
  } catch {
    /* best-effort — non-fatal if storage is unavailable */
  }
}

const TIPS = [
  { icon: Sun, label: "Good, even lighting" },
  { icon: UserSquare2, label: "Full-body photo" },
  { icon: MoveVertical, label: "Stand up straight" },
  { icon: Eye, label: "Face clearly visible" },
  { icon: ImageOff, label: "Neutral, uncluttered background" },
  { icon: Ban, label: "No mirror selfies" },
  { icon: Users2, label: "Only one person in frame" },
  { icon: Camera, label: "Straight-on camera angle" },
];

interface TryOnGuidelinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after "Got it" is clicked and the seen-state has been persisted. */
  onAcknowledge?: () => void;
  /** Where this modal is being shown from — for analytics only. */
  source?: string;
}

export function TryOnGuidelinesModal({ open, onOpenChange, onAcknowledge, source }: TryOnGuidelinesModalProps) {
  const handleGotIt = () => {
    markTryOnGuidelinesSeen();
    posthogCapture("tryon_guidelines_acknowledged", { source });
    onOpenChange(false);
    onAcknowledge?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Dismissing without "Got it" (e.g. Escape / overlay click) still counts as seen —
        // we never want to re-interrupt the flow mid-session.
        if (!next) markTryOnGuidelinesSeen();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Get the best try-on result</DialogTitle>
          <DialogDescription>
            A few quick tips before your first generation — better photos mean a more accurate try-on.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          {TIPS.map((tip) => (
            <li
              key={tip.label}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5"
            >
              <div className="w-8 h-8 rounded-lg bg-foreground/[0.06] flex items-center justify-center flex-shrink-0">
                <tip.icon className="h-4 w-4 text-foreground" />
              </div>
              <p className="text-sm text-foreground/90 leading-snug">{tip.label}</p>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button onClick={handleGotIt} className="w-full gradient-primary text-primary-foreground shadow-soft gap-2">
            <CheckCircle2 className="h-4 w-4" /> Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
