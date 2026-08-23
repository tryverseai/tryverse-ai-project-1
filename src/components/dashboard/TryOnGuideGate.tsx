import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TryOnGuideContent } from "@/components/dashboard/TryOnGuideContent";
import { markTryOnGuideAcknowledged } from "@/lib/dashboardTabs";
import { posthogCapture } from "@/lib/posthog";

/**
 * Mandatory onboarding gate — renders on top of the entire dashboard, for every tab, until the
 * user explicitly acknowledges it. Unlike `TryOnGuideTab` (a normal, revisitable sidebar tab for
 * reference), this is a real interaction lock: Radix's Dialog overlay + focus trap block pointer
 * events and keyboard navigation to everything underneath, `onEscapeKeyDown`/`onPointerDownOutside`/
 * `onInteractOutside` are all suppressed so there is no dismiss path other than the button below,
 * and because it's driven by React state (not a route/tab), browser back/forward or editing the
 * `?tab=` query param cannot bypass it — the gate stays mounted above whatever tab is "active"
 * underneath until `onAcknowledge` fires.
 */
export function TryOnGuideGate({ onAcknowledge }: { onAcknowledge: () => void }) {
  const handleAcknowledge = () => {
    markTryOnGuideAcknowledged();
    posthogCapture("tryon_guide_acknowledged");
    onAcknowledge();
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-2xl w-[92vw] max-h-[88vh] overflow-y-auto [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Try-On Guide</DialogTitle>
        <TryOnGuideContent />
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Next: connect your storefront so TryVerse can go live on your product pages.
          </p>
          <Button onClick={handleAcknowledge} className="gradient-primary text-primary-foreground shadow-soft gap-2">
            <CheckCircle2 className="h-4 w-4" />
            I Understand &amp; Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
