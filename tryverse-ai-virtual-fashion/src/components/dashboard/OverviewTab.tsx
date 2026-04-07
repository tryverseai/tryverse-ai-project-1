import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, TrendingUp, Users, Zap, Loader2, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { getCredits } from "@/lib/backendApi";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { isConvexDataEnabled } from "@/lib/convexData";

interface Stats {
  totalTryOns: number;
  totalGenerations: number;
  totalActivations: number;
  todayTryOns: number;
  weeklyData: { date: string; tryOns: number }[];
}

interface Profile {
  widget_activated: boolean;
}

function planLabel(planId: string): string {
  const map: Record<string, string> = {
    free: "Free",
    pro: "Pro",
    creator: "Creator",
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
    free_trial: "Free trial",
    trial: "Trial",
  };
  return map[planId] || planId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type CreditSummary = Awaited<ReturnType<typeof getCredits>>;

function buildStatsFromEvents(
  allEvents: { event_type: string; created_at: string }[]
): Stats {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalTryOns = allEvents.filter((e) => e.event_type === "try_on").length;
  const totalGenerations = allEvents.filter((e) => e.event_type === "ai_generation").length;
  const totalActivations = allEvents.filter((e) => e.event_type === "widget_activation").length;
  const todayTryOns = allEvents.filter(
    (e) => e.event_type === "try_on" && new Date(e.created_at) >= todayStart
  ).length;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyData: { date: string; tryOns: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const count = allEvents.filter(
      (e) =>
        e.event_type === "try_on" && new Date(e.created_at) >= dayStart && new Date(e.created_at) < dayEnd
    ).length;
    weeklyData.push({ date: days[d.getDay()], tryOns: count });
  }

  return { totalTryOns, totalGenerations, totalActivations, todayTryOns, weeklyData };
}

export function OverviewTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const convexOn = isConvexDataEnabled();
  const cxEvents = useQuery(api.overview.getMyUsageEvents, convexOn && user ? {} : "skip");
  const cxWidgetActivated = useQuery(api.overview.getWidgetActivated, convexOn && user ? {} : "skip");

  const [stats, setStats] = useState<Stats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (!convexOn) {
      setLoading(false);
      setStats(null);
      return;
    }

    if (cxEvents === undefined || cxWidgetActivated === undefined) {
      setLoading(true);
      return;
    }
    const allEvents = cxEvents ?? [];
    setStats(buildStatsFromEvents(allEvents));
    setProfile(cxWidgetActivated === null ? null : { widget_activated: cxWidgetActivated });
    void getCredits()
      .then(setCredits)
      .catch(() => setCredits(null))
      .finally(() => setLoading(false));
  }, [user, convexOn, cxEvents, cxWidgetActivated]);

  if (!convexOn) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Set <code className="rounded bg-muted px-1">VITE_CONVEX_URL</code> to load overview analytics.
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const freeRemaining = credits?.freeCreditsRemaining ?? 0;
  const freeTotal = credits?.freeCreditsTotal ?? 0;
  const planId = credits?.plan ?? "free";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Plan, credits, and recent activity</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <Zap className="h-3.5 w-3.5" /> Plan
          </div>
          <p className="mt-2 font-display text-lg font-semibold text-foreground">{planLabel(planId)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {credits?.isUnlimited
              ? "Unlimited try-ons this period"
              : `${freeRemaining} / ${freeTotal} free try-ons left`}
          </p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <Eye className="h-3.5 w-3.5" /> Try-ons
          </div>
          <p className="mt-2 font-display text-lg font-semibold text-foreground">{stats.totalTryOns}</p>
          <p className="text-xs text-muted-foreground mt-1">Today: {stats.todayTryOns}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <Sparkles className="h-3.5 w-3.5" /> AI generations
          </div>
          <p className="mt-2 font-display text-lg font-semibold text-foreground">{stats.totalGenerations}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <Users className="h-3.5 w-3.5" /> Widget
          </div>
          <p className="mt-2 font-display text-lg font-semibold text-foreground">
            {profile?.widget_activated ? "Active" : "Not activated"}
          </p>
          {!profile?.widget_activated && (
            <Button variant="link" className="h-auto p-0 mt-2 text-xs" onClick={() => navigate("/dashboard/business?tab=Widget")}>
              Set up widget
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display font-semibold text-foreground">Try-ons (last 7 days)</h3>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.weeklyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="tryOns" stroke="hsl(var(--foreground))" fill="hsl(var(--foreground) / 0.08)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
