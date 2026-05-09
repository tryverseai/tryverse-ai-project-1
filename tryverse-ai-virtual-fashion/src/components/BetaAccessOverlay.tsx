import { Lock, MessageSquareText } from "lucide-react";
import { useQuery } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "../../convex/_generated/api";

const INSTAGRAM_URL = "https://instagram.com/tryverseai";
const X_URL = "https://x.com/tryverseai";

/**
 * Closed-beta gate: show until `profiles.beta_approved === true` or legacy rows (undefined) allow access.
 * Uses Convex `getMyProfile` so this matches the DB immediately after signup — the REST `/account/me`
 * hook could lag or return null and accidentally hid this overlay.
 */
export function BetaAccessOverlay() {
  const { signOut, user } = useAuth();
  const profile = useQuery(api.profiles.getMyProfile, user ? {} : "skip");

  if (!user) return null;

  /** Query still loading */
  if (profile === undefined) {
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

  const betaApproved = profile.beta_approved;
  /** Legacy profiles: undefined / null treated as grandfathered (see schema comment). */
  if (betaApproved !== false) return null;

  const rejected = profile.beta_rejected === true;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-4 text-center overflow-y-auto"
      style={{
        background:
          "linear-gradient(165deg, #faf5f0 0%, #f4e8e0 45%, #efe2d8 100%)",
      }}
    >
      <div className="max-w-lg w-full space-y-8 py-10">
        <div className="flex justify-center">
          <div className="rounded-full bg-white/90 p-4 shadow-sm ring-1 ring-stone-200/80">
            <Lock className="h-10 w-10 text-amber-800/90" aria-hidden />
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-stone-500 mb-2">TryVerse</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
            {rejected ? "Access not approved" : "We're in Closed Beta"}
          </h1>
          <p className="mt-3 text-stone-600 text-sm sm:text-base leading-relaxed">
            {rejected
              ? "We weren't able to approve access for this account. If you think this is a mistake, contact support."
              : "We're currently rolling out TryVerse to a select group of teams. We'll be opening access soon!"}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white/95 backdrop-blur-sm px-5 py-5 text-left shadow-md shadow-stone-300/40">
          <div className="flex gap-3">
            <MessageSquareText className="h-9 w-9 shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="font-semibold text-stone-900">Check your email for updates</p>
              <p className="text-sm text-stone-600 mt-1">
                {rejected
                  ? "You can sign out and try again later if your situation changes."
                  : "We'll notify you when we're ready to onboard your team."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-stone-500">Follow us for updates</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-800 hover:bg-stone-50 transition-colors"
            >
              Instagram
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-800 hover:bg-stone-50 transition-colors"
            >
              X (Twitter)
            </a>
          </div>
        </div>

        <a
          href="https://tryverseai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-full border border-stone-200 bg-white px-5 py-2 text-xs text-stone-600 hover:text-stone-900"
        >
          tryverseai.com
        </a>

        <p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-amber-900/80 hover:text-amber-950 underline underline-offset-2"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
