import { Lock, MessageSquareText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

const INSTAGRAM_URL = "https://instagram.com/tryverseai";
const X_URL = "https://x.com/tryverseai";

/** Full-screen gated beta UX when Convex profile has beta_approved === false. Legacy rows (undefined) pass through. */
export function BetaAccessOverlay() {
  const { signOut } = useAuth();
  const { profile, loading } = useSyncedConvexProfile();

  if (loading || !profile) return null;

  const betaApproved = profile.beta_approved;
  if (betaApproved !== false) return null;

  const rejected = profile.beta_rejected === true;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-4 text-center"
      style={{
        background:
          "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(139, 92, 246, 0.15), transparent 55%), #0a1628",
      }}
    >
      <div className="max-w-lg w-full space-y-8">
        <div className="flex justify-center">
          <div className="rounded-full bg-violet-500/15 p-4 ring-1 ring-violet-400/40">
            <Lock className="h-10 w-10 text-violet-400" aria-hidden />
          </div>
        </div>
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {rejected ? "Access not approved" : "You're In."}
          </h1>
          <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
            {rejected
              ? "We weren't able to approve access for this account. If you think this is a mistake, reply to any TryVerse email or contact support."
              : "We're currently in closed beta and rolling out access to a select group of users. We'll reach out soon."}
          </p>
        </div>

        <div className="rounded-2xl border border-violet-500/30 bg-slate-900/60 backdrop-blur-sm px-5 py-5 text-left shadow-lg shadow-violet-950/40">
          <div className="flex gap-3">
            <MessageSquareText className="h-9 w-9 shrink-0 text-violet-400" aria-hidden />
            <div>
              <p className="font-semibold text-white">Check your email for updates</p>
              <p className="text-sm text-slate-400 mt-1">
                {rejected
                  ? "You can sign out and try again later if your situation changes."
                  : "We'll notify you when your access is approved"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Follow us for updates</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 hover:border-violet-500/40 transition-colors"
            >
              Instagram
            </a>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 hover:border-violet-500/40 transition-colors"
            >
              X (Twitter)
            </a>
          </div>
        </div>

        <a
          href="https://tryverseai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs text-slate-300 hover:text-white hover:border-violet-500/40"
        >
          tryverseai.com
        </a>

        <p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-violet-300 hover:text-violet-200 underline underline-offset-2"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
