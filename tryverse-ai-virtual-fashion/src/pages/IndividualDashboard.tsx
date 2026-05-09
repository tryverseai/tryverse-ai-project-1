import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import TryOnStudio from "@/pages/TryOnStudio";
import { Button } from "@/components/ui/button";
import { Sparkles, Images, Compass, UserRound, Trash2, Download, Loader2, Users, BookOpen } from "lucide-react";
import { TryOnGuideContent } from "@/components/dashboard/TryOnGuideContent";
import { useAuth } from "@/contexts/AuthContext";
import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";
import { ApiError, getTryOnHistory, getCredits, deleteTryOn } from "@/lib/backendApi";
import { toast } from "sonner";
import { safeImageSrcForDom, openExternalHttpUrlInNewTab } from "@/lib/safeUrl";
import { Link } from "react-router-dom";

function planLabel(planId: string): string {
  const map: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    creator: "Creator",
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
  };
  return map[planId] || planId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const tabs = [
  { id: "guide", label: "Tips & guide", icon: BookOpen },
  { id: "studio", label: "Try on", icon: Sparkles },
  { id: "models", label: "Models", icon: Users },
  { id: "creations", label: "My creations", icon: Images },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "profile", label: "Profile", icon: UserRound },
] as const;

type TabId = (typeof tabs)[number]["id"];

/** Type guard — narrows a raw string from the URL to a valid TabId. */
function isTabId(value: string | null): value is TabId {
  return tabs.some((t) => t.id === value);
}

interface HistoryItem {
  id: string;
  status: string;
  category: string;
  resultUrl: string | null;
  createdAt?: string;
}

const IndividualDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTabParam = searchParams.get("tab");
  const tabParam: TabId | null = isTabId(rawTabParam) ? rawTabParam : null;
  const [activeTab, setActiveTab] = useState<TabId>("guide");
  const { user, signOut } = useAuth();
  const { loading: cxProfileLoading, convexOn } = useSyncedConvexProfile();
  const [credits, setCredits] = useState<{
    plan: string;
    free: number;
    freeTotal: number;
    monthly: number;
    monthlyTotal: number;
    unlimited: boolean;
  } | null>(null);
  const [creditsStatus, setCreditsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [creations, setCreations] = useState<HistoryItem[]>([]);
  const [creationsLoading, setCreationsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    // tabParam is already narrowed to TabId | null by isTabId() above,
    // so no second tabs.some() check is needed here.
    if (tabParam) {
      setActiveTab(tabParam);
      return;
    }
    setActiveTab("guide");
    setSearchParams({ tab: "guide" }, { replace: true });
  }, [tabParam, setSearchParams]);

  const selectTab = (id: TabId) => {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  };

  const loadCredits = useCallback(async () => {
    setCreditsStatus("loading");
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const c = await getCredits();
        setCredits({
          plan: c.plan,
          free: c.freeCreditsRemaining,
          freeTotal: c.freeCreditsTotal,
          monthly: c.monthlyCreditsRemaining,
          monthlyTotal: c.monthlyCreditsTotal,
          unlimited: c.isUnlimited,
        });
        setCreditsStatus("ready");
        return;
      } catch (e) {
        const retry =
          e instanceof ApiError && e.status === 404 && attempt < maxAttempts - 1;
        if (retry) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        setCredits(null);
        setCreditsStatus("error");
        return;
      }
    }
  }, []);

  const loadCreations = useCallback(async () => {
    setCreationsLoading(true);
    try {
      const aggregated: HistoryItem[] = [];
      let cursor: string | null = null;
      let guard = 0;
      const MAX_PAGES = 40;
      while (guard < MAX_PAGES) {
        guard += 1;
        const res = await getTryOnHistory(1, undefined, cursor);
        const rows: HistoryItem[] = (res.tryons || []).map((raw) => {
          const r = raw as typeof raw & {
            id?: string;
            tryonId?: string;
            createdAt?: string;
            created_at?: string | null;
          };
          const created =
            typeof r.created_at === "string" && r.created_at
              ? r.created_at
              : typeof r.createdAt === "string"
                ? r.createdAt
                : undefined;
          return {
            id: r.id ?? r.tryonId ?? "",
            status: r.status,
            category: r.category,
            resultUrl: r.resultUrl ?? null,
            createdAt: created,
          };
        });
        aggregated.push(...rows.filter((r) => r.id && r.status === "completed" && r.resultUrl));
        if (res.isDone || res.nextCursor == null) break;
        cursor = res.nextCursor;
      }
      aggregated.sort((a, b) => {
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        return tb - ta;
      });
      setCreations(aggregated);
    } catch {
      toast.error("Could not load your creations.");
      setCreations([]);
    } finally {
      setCreationsLoading(false);
    }
  }, []);

  // Wait for Convex profile bootstrap when Convex is enabled so `/api/credits` can resolve the row.
  useEffect(() => {
    if (convexOn && cxProfileLoading) return;
    void loadCredits();
  }, [convexOn, cxProfileLoading, loadCredits]);

  /** Reload gallery when the signed-in user changes (login / logout / password reset). */
  useEffect(() => {
    if (!user?.id) {
      setCreations([]);
      return;
    }
    void loadCreations();
  }, [user?.id, loadCreations]);

  useEffect(() => {
    if (activeTab === "creations") void loadCreations();
  }, [activeTab, loadCreations]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTryOn(id);
      setCreations((prev) => prev.filter((c) => c.id !== id));
      toast.success("Removed from your gallery.");
    } catch {
      toast.error("Could not delete this item.");
    } finally {
      setDeletingId(null);
    }
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "You";

  return (
    <>
      <div className="min-h-screen bg-background pb-24 md:pb-8">
        <Navbar />
        <main className="pt-[var(--navbar-height)]">
          <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
          <div className="mb-6 md:mb-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Personal</p>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Hi {displayName}, Welcome to your Try On Studio
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Try outfits on your photos — quick, private, and yours to download.
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 md:p-5 mb-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Your plan &amp; credits</p>
            {creditsStatus === "ready" && credits ? (
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">{planLabel(credits.plan)}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Free try-ons:{" "}
                    <span className="text-foreground font-medium">
                      {credits.free} / {credits.freeTotal}
                    </span>{" "}
                    left
                  </p>
                  {!["free", "free_trial", "trial"].includes(credits.plan) &&
                  !credits.unlimited &&
                  credits.monthlyTotal > 0 ? (
                    <p className="text-sm text-muted-foreground mt-1">
                      Plan try-ons this cycle:{" "}
                      <span className="text-foreground font-medium">
                        {credits.monthly} / {credits.monthlyTotal}
                      </span>
                    </p>
                  ) : null}
                  {credits.unlimited ? (
                    <p className="text-sm text-muted-foreground mt-1">Included try-ons: unlimited on your plan</p>
                  ) : null}
                </div>
                <Link
                  to="/pricing"
                  className="text-sm font-medium text-foreground underline underline-offset-4 self-start sm:self-center"
                >
                  Change plan
                </Link>
              </div>
            ) : creditsStatus === "error" ? (
              <p className="text-sm text-muted-foreground">
                Could not load credits. Refresh the page or sign out and back in if this persists.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Loading credits…</p>
            )}
          </div>

          {/* Desktop tabs */}
          <div className="hidden md:flex gap-2 border-b border-border mb-8">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === t.id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="md:hidden mb-4">
            <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${
                    activeTab === t.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "guide" && (
            <div className="max-w-3xl mx-auto">
              <TryOnGuideContent />
            </div>
          )}

          {activeTab === "studio" && (
            <TryOnStudio variant="embedded" audience="individual" clothingOnly />
          )}

          {activeTab === "models" && (
            <div className="space-y-4">
              <h2 className="font-display text-xl font-semibold text-foreground">Model library</h2>
              <TryOnStudio
                variant="embedded"
                audience="individual"
                initialMode="ai-model"
                clothingOnly
                creditsHelpPath="/dashboard/individual?tab=profile"
              />
            </div>
          )}

          {activeTab === "creations" && (
            <div className="space-y-4">
              {creationsLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : creations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
                  <Images className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium">No creations yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Run a try-on in the Try on tab — results show up here.</p>
                  <Button type="button" onClick={() => selectTab("studio")}>
                    Start a try-on
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                  {creations.map((item) => (
                    <div
                      key={item.id}
                      className="group rounded-xl border border-border bg-card overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[3/4] bg-muted relative">
                        {item.resultUrl && (
                          <img
                            src={safeImageSrcForDom(item.resultUrl)}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                      </div>
                      <div className="p-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="flex-1 gap-1"
                          onClick={() => item.resultUrl && openExternalHttpUrlInNewTab(item.resultUrl)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          disabled={deletingId === item.id}
                          onClick={() => void handleDelete(item.id)}
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "explore" && (
            <div className="rounded-2xl border border-border bg-card p-8 md:p-10 text-center max-w-lg mx-auto">
              <Compass className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h2 className="font-display text-lg font-semibold text-foreground">Explore</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Curated looks and demos are coming soon. For now, upload any product photo in{" "}
                <button type="button" className="text-foreground font-medium underline" onClick={() => selectTab("studio")}>
                  Try on
                </button>
                .
              </p>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="max-w-md space-y-6">
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h2 className="font-display text-lg font-semibold text-foreground">Account</h2>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium">{user?.email}</p>
                </div>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">Plan &amp; try-ons</p>
                  {creditsStatus === "ready" && credits ? (
                    <p className="text-foreground">
                      Plan: <strong>{planLabel(credits.plan)}</strong>
                      <br />
                      Free pool: <strong>{credits.free}</strong> / {credits.freeTotal}
                      {!["free", "free_trial", "trial"].includes(credits.plan) &&
                      !credits.unlimited &&
                      credits.monthlyTotal > 0 ? (
                        <>
                          <br />
                          This cycle: <strong>{credits.monthly}</strong> / {credits.monthlyTotal}
                        </>
                      ) : null}
                      {credits.unlimited ? (
                        <>
                          <br />
                          Included try-ons: <strong>unlimited</strong>
                        </>
                      ) : null}
                    </p>
                  ) : creditsStatus === "loading" ? (
                    <p className="text-muted-foreground">Loading…</p>
                  ) : (
                    <p className="text-muted-foreground">Could not load credits.</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Need more for your store?{" "}
                  <Link to="/pricing" className="text-foreground font-medium underline underline-offset-2">
                    View plans
                  </Link>
                </p>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          )}
          </div>
        </main>
      </div>
    </>
  );
};

export default IndividualDashboard;
