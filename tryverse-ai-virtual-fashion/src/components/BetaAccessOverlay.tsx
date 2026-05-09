import { Lock, MessageSquareText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";
import { TryVerseLogo } from "@/components/TryVerseLogo";
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
  const { signOut, user } = useAuth();
  const profile = useQuery(api.profiles.getMyProfile, user ? {} : "skip");
  const { bypass: adminPortalBypass, checking: adminPortalChecking } = useAdminOperatorBypass();

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
        role="alert"
      >
        <p className="text-sm font-medium text-foreground">Finishing setup…</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Creating your workspace. This usually takes a few seconds.
        </p>
      </div>
    );
  }

  if (profile.beta_approved === true) return null;

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
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              {rejected ? "Access not approved" : "We're in Closed Beta"}
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">
              {rejected
                ? "We weren't able to approve access for this account. If you think this is a mistake, contact support."
                : "We're currently rolling out TryVerse to a select group of users. We'll be opening access soon!"}
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
