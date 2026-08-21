import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TryOnGuideContent } from "@/components/dashboard/TryOnGuideContent";
import { CONNECT_TAB } from "@/lib/dashboardTabs";
import { posthogCapture } from "@/lib/posthog";

/** localStorage key — mirrors TryOnGuidelinesModal's pattern; a distinct step (full guide tab
 * read end-to-end, not just the pre-generation consent modal), so kept as its own key. */
const TRYON_GUIDE_ACKNOWLEDGED_KEY = "tv_acknowledged_tryon_guide";

export function hasAcknowledgedTryOnGuide(): boolean {
  try {
    return localStorage.getItem(TRYON_GUIDE_ACKNOWLEDGED_KEY) === "1";
  } catch {
    return false;
  }
}

function markTryOnGuideAcknowledged(): void {
  try {
    localStorage.setItem(TRYON_GUIDE_ACKNOWLEDGED_KEY, "1");
  } catch {
    /* best-effort — non-fatal if storage is unavailable */
  }
}

export function TryOnGuideTab() {
  const [, setSearchParams] = useSearchParams();

  const handleAcknowledge = () => {
    markTryOnGuideAcknowledged();
    posthogCapture("tryon_guide_acknowledged");
    setSearchParams({ tab: CONNECT_TAB });
  };

  return (
    <div className="max-w-3xl mx-auto">
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
    </div>
  );
}
