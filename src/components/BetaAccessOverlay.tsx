import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import { TermsPostBetaGate } from "@/components/TermsPostBetaGate";
import { PlanSelectionGate } from "@/components/PlanSelectionGate";
import { useAdminOperatorBypass } from "@/hooks/useAdminOperatorBypass";
import { Button } from "@/components/ui/button";

/** How long to wait before offering a way out of a stuck "Finishing setup…" screen. */
const SETUP_STUCK_TIMEOUT_MS = 10_000;

/**
 * TryVerse is self-serve now — no closed-beta wall. This overlay only covers two real states:
 * the profile bootstrap finishing right after signup, and one-time Terms & Privacy acceptance.
 */
export function BetaAccessOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const profile = useQuery(api.profiles.getMyProfile, user ? {} : "skip");
  const { bypass: adminPortalBypass, checking: adminPortalChecking } = useAdminOperatorBypass();
  const [setupStuck, setSetupStuck] = useState(false);

  /** Workspace bootstrap only ever runs once, right after sign-in — if it failed, nothing
   * retries it and `profile` stays `null` forever. There's no way to recover from that except
   * re-authenticating (which re-runs bootstrap), so offer that out instead of an infinite spinner. */
  useEffect(() => {
    if (profile !== null) {
      setSetupStuck(false);
      return;
    }
    const t = setTimeout(() => setSetupStuck(true), SETUP_STUCK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [profile]);

  if (!user) return null;

  /** Admin portal shares Convex session but gates with its own secret. */
  if (location.pathname === "/admin") return null;

  const accessStillLoading = profile === undefined || adminPortalChecking;
  if (accessStillLoading) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/85 backdrop-blur-md"
        role="status"
        aria-live="polite"
        aria-label="Loading account"
      >
        <div className="h-9 w-9 rounded-full border-2 border-muted border-t-foreground animate-spin" />
        <p className="mt-4 text-sm text-muted-foreground">Checking your access…</p>
      </div>
    );
  }
  if (adminPortalBypass) return null;

  /** Bootstrap not finished yet — block dashboard until profile row exists */
  if (profile === null) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-4 text-center bg-background/90 backdrop-blur-md"
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">Finishing setup…</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Creating your workspace. This usually takes a few seconds.
        </p>
        {setupStuck && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground max-w-sm">
              This is taking longer than expected.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void signOut().then(() => navigate("/auth"));
              }}
            >
              Back to sign in
            </Button>
          </div>
        )}
      </div>
    );
  }

  const termsOk = Boolean(profile.terms_of_service_accepted_at);
  if (!termsOk) {
    return <TermsPostBetaGate />;
  }

  // Plan selection only applies to business accounts — individuals have no store to connect.
  const planOk = profile.account_type !== "business" || Boolean(profile.plan_selected_at);
  if (!planOk) {
    return <PlanSelectionGate onComplete={() => {}} />;
  }

  return null;
}
