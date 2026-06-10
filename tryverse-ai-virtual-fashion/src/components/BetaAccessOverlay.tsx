import { useEffect, useRef, useState } from "react";
import { Lock, MessageSquareText } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { TermsPostBetaGate } from "@/components/TermsPostBetaGate";
import { Button } from "@/components/ui/button";
import { useAdminOperatorBypass } from "@/hooks/useAdminOperatorBypass";

const INSTAGRAM_URL = "https://instagram.com/tryverseai";
const X_URL = "https://x.com/tryverseai";
const LINKEDIN_URL = "https://www.linkedin.com/company/tryverse-ai";

/**
 * Closed-beta gate: only `profiles.beta_approved === true` may use authenticated app routes.
 * Operators reach `/admin` without this overlay so they can approve signups (separate admin key UI).
 */
export function BetaAccessOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, syncBackendSession } = useAuth();
  const profile = useQuery(api.profiles.getMyProfile, user ? {} : "skip");
  const { bypass: adminPortalBypass, checking: adminPortalChecking } = useAdminOperatorBypass();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapBusy, setBootstrapBusy] = useState(false);
  const bootstrapRunId = useRef(0);

  const runWorkspaceBootstrap = async () => {
    if (!user?.email) return;
    const runId = ++bootstrapRunId.current;
    setBootstrapBusy(true);
    setBootstrapError(null);
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (runId !== bootstrapRunId.current) return;
        const result = await syncBackendSession({ email: user.email });
        if (result.deviceApprovalRequired) {
          navigate("/auth/approve-device", { replace: true });
          return;
        }
        if (!result.error) return;
        await new Promise<void>((r) => setTimeout(r, 600 + attempt * 400));
      }
      if (runId === bootstrapRunId.current) {
        setBootstrapError("We couldn't finish setting up your workspace. Try again or refresh the page.");
      }
    } finally {
      if (runId === bootstrapRunId.current) setBootstrapBusy(false);
    }
  };

  useEffect(() => {
    if (profile !== null || !user?.email) return;
    void runWorkspaceBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when profile/user identity changes
  }, [profile, user?.email]);

  if (!user) return null;

  /** Admin portal shares Convex session but gates with its own secret — allow without beta approval. */
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
        role="status"
        aria-live="polite"
        aria-label="Creating your workspace"
      >
        <div className="h-10 w-10 rounded-full border-2 border-muted border-t-foreground animate-spin mb-5" />
        <p className="text-sm font-medium text-foreground">Creating your workspace…</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          {bootstrapBusy
            ? "Setting up your brand profile and credits…"
            : "This usually takes a few seconds."}
        </p>
        {bootstrapError ? (
          <div className="mt-6 space-y-3 max-w-sm">
            <p className="text-sm text-destructive">{bootstrapError}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={bootstrapBusy}
                onClick={() => void runWorkspaceBootstrap()}
              >
                Try again
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => window.location.reload()}>
                Refresh page
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (profile.beta_approved === true) {
    const termsOk = Boolean(profile.terms_of_service_accepted_at);
    if (!termsOk) {
      return <TermsPostBetaGate />;
    }
    return null;
  }

  const rejected = profile.beta_rejected === true;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex min-h-full flex-col items-center justify-center px-4 py-10 text-center"
      >
        <div className="w-full max-w-lg space-y-8">
          <div className="flex flex-col items-center gap-6">
            <Link to="/" className="inline-block">
              <TryVerseLogo height={96} />
            </Link>
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-soft"
              aria-hidden
            >
              <Lock className="h-7 w-7" />
            </div>
          </div>

          <div>
            <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-2">TryVerse</p>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              {rejected ? "Access not approved" : "Your brand account has been created"}
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">
              {rejected
                ? "We weren't able to approve access for this account. If you think this is a mistake, contact support."
                : "We're currently onboarding founding brands by invitation. Our team will reach out within 48 hours to schedule your onboarding walkthrough."}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card px-5 py-5 text-left shadow-card">
            <div className="flex gap-3">
              <MessageSquareText className="h-9 w-9 shrink-0 text-foreground opacity-90" aria-hidden />
              <div>
                <p className="font-semibold text-foreground">Check your email for updates</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rejected
                    ? "You can sign out and try again later if your situation changes."
                    : "We'll notify you when we're ready to onboard you."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Follow us for updates
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full bg-background shadow-none" asChild>
                <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                  Instagram
                </a>
              </Button>
              <Button variant="outline" size="sm" className="rounded-full bg-background shadow-none" asChild>
                <a href={X_URL} target="_blank" rel="noopener noreferrer">
                  X (Twitter)
                </a>
              </Button>
              <Button variant="outline" size="sm" className="rounded-full bg-background shadow-none" asChild>
                <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                  LinkedIn
                </a>
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button variant="outline" size="sm" className="rounded-full bg-background text-muted-foreground shadow-none hover:text-foreground" asChild>
              <a href="https://tryverseai.com" target="_blank" rel="noopener noreferrer">
                tryverseai.com
              </a>
            </Button>

            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm font-normal text-muted-foreground hover:text-foreground"
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
