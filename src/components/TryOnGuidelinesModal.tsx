import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Sun,
  UserSquare2,
  ScanFace,
  Eye,
  CheckCircle2,
  ShieldCheck,
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
import { Checkbox } from "@/components/ui/checkbox";
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
  { icon: UserSquare2, label: "Full-body photo" },
  { icon: ScanFace, label: "Neutral, natural pose" },
  { icon: CheckCircle2, label: "Clear, unobstructed visibility" },
  { icon: Eye, label: "Face and body clearly visible" },
  { icon: Sun, label: "Good, even lighting" },
];

type Step = "consent" | "guidance";

interface TryOnGuidelinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after consent is given and the seen-state has been persisted. */
  onAcknowledge?: () => void;
  /** Where this modal is being shown from — for analytics only. */
  source?: string;
}

/** Consent screen first, then photo-quality guidance — required flow order. */
export function TryOnGuidelinesModal({ open, onOpenChange, onAcknowledge, source }: TryOnGuidelinesModalProps) {
  const [step, setStep] = useState<Step>("consent");
  const [ownPhotoConfirmed, setOwnPhotoConfirmed] = useState(false);
  const [policyAgreed, setPolicyAgreed] = useState(false);

  const resetAndClose = (next: boolean) => {
    if (!next) {
      // Reset internal state on close so a re-open always starts from consent, not
      // wherever the user last left off mid-flow.
      setStep("consent");
      setOwnPhotoConfirmed(false);
      setPolicyAgreed(false);
    }
    onOpenChange(next);
  };

  const handleContinueToGuidance = () => {
    posthogCapture("tryon_guidelines_consent_given", { source });
    setStep("guidance");
  };

  const handleGetStarted = () => {
    markTryOnGuidelinesSeen();
    posthogCapture("tryon_guidelines_acknowledged", { source });
    resetAndClose(false);
    onOpenChange(false);
    onAcknowledge?.();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-lg">
        {step === "consent" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Before you continue
              </DialogTitle>
              <DialogDescription>
                TryVerse processes your photo only to generate this try-on result.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <label className="flex items-start gap-3 rounded-xl border border-border/50 bg-card px-3 py-3 cursor-pointer">
                <Checkbox
                  checked={ownPhotoConfirmed}
                  onCheckedChange={(v) => setOwnPhotoConfirmed(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground/90 leading-snug">
                  This is my own photo, or I have permission from the person in it to use it here.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-border/50 bg-card px-3 py-3 cursor-pointer">
                <Checkbox
                  checked={policyAgreed}
                  onCheckedChange={(v) => setPolicyAgreed(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground/90 leading-snug">
                  I agree to the{" "}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    Terms of Service
                  </Link>
                  .
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button
                onClick={handleContinueToGuidance}
                disabled={!ownPhotoConfirmed || !policyAgreed}
                className="w-full gradient-primary text-primary-foreground shadow-soft gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">For best results</DialogTitle>
              <DialogDescription>
                Upload a high-quality photo with:
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
              <Button onClick={handleGetStarted} className="w-full gradient-primary text-primary-foreground shadow-soft gap-2">
                <CheckCircle2 className="h-4 w-4" /> Get started
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
