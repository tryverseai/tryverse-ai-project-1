import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, TrendingUp, Users, Zap, Loader2, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCredits } from "@/lib/backendApi";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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

export function OverviewTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credits, setCredits] = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [{ data: events }, { data: profileData }, creditSummary] = await Promise.all([
        supabase.from("usage_events").select("event_type, created_at").order("created_at", { ascending: true }),
        supabase.from("profiles").select("widget_activated").eq("id", user.id).single(),
        getCredits().catch(() => null),
      ]);

      const allEvents = events || [];
      const totalTryOns = allEvents.filter(e => e.event_type === "try_on").length;
      const totalGenerations = allEvents.filter(e => e.event_type === "ai_generation").length;
      const totalActivations = allEvents.filter(e => e.event_type === "widget_activation").length;
      const todayTryOns = allEvents.filter(e => e.event_type === "try_on" && new Date(e.created_at) >= todayStart).length;

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyData: { date: string; tryOns: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const count = allEvents.filter(e =>
          e.event_type === "try_on" && new Date(e.created_at) >= dayStart && new Date(e.created_at) < dayEnd
        ).length;
        weeklyData.push({ date: days[d.getDay()], tryOns: count });
      }

      setStats({ totalTryOns, totalGenerations, totalActivations, todayTryOns, weeklyData });
      const row = profileData as unknown as Profile | null;
      setProfile(
        row
          ? {
              widget_activated: row.widget_activated,
            }
          : null
      );
      setCredits(creditSummary);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const freeRemaining = credits?.freeCreditsRemaining ?? 0;
  const freeTotal = credits?.freeCreditsTotal ?? 0;
  const monthlyRemaining = credits?.monthlyCreditsRemaining ?? 0;
  const monthlyTotal = credits?.monthlyCreditsTotal ?? 0;
  const showMonthly =
    Boolean(credits?.plan && credits.plan !== "free" && credits.plan !== "free_trial" && credits.plan !== "trial") &&
    !credits?.isUnlimited &&
    monthlyTotal > 0;
  const tryOnBudgetLow =
    Boolean(credits) &&
    !credits!.isUnlimited &&
    freeRemaining <= 0 &&
    (!showMonthly || monthlyRemaining <= 0);
  const widgetActivated = profile?.widget_activated ?? false;
  const planName = credits ? planLabel(credits.plan) : "—";

  const statCards = [
    { label: "Total Try-Ons", value: stats?.totalTryOns.toLocaleString() || "0", icon: Eye },
    { label: "Today's Try-Ons", value: stats?.todayTryOns.toLocaleString() || "0", icon: TrendingUp },
    { label: "AI Generations", value: stats?.totalGenerations.toLocaleString() || "0", icon: Zap },
    { label: "Widget Activations", value: stats?.totalActivations.toLocaleString() || "0", icon: Users },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Your virtual try-on performance at a glance</p>
      </div>

      {/* Credits & plan */}
      <div
        className={`rounded-xl border p-5 mb-8 ${
          !credits ? "border-border/50 bg-card" : !tryOnBudgetLow ? "border-border/50 bg-card" : "border-destructive/30 bg-destructive/5"
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                !credits || !tryOnBudgetLow ? "gradient-primary shadow-soft" : "bg-destructive/10"
              }`}
            >
              <Sparkles
                className={`h-5 w-5 ${!credits || !tryOnBudgetLow ? "text-primary-foreground" : "text-destructive"}`}
              />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="font-display text-sm font-semibold text-foreground">Plan &amp; try-ons</p>
              {credits ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Current plan: <span className="text-foreground font-medium">{planName}</span>
                    {credits.isUnlimited ? (
                      <span className="text-foreground font-medium"> · Unlimited included try-ons</span>
                    ) : null}
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    Free pool: {freeRemaining} / {freeTotal}
                    <span className="text-sm font-normal text-muted-foreground"> remaining</span>
                  </p>
                  {showMonthly && (
                    <p className="text-sm font-medium text-foreground">
                      Plan try-ons this cycle: {monthlyRemaining.toLocaleString()} / {monthlyTotal.toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Credit details will appear here once loaded.</p>
              )}
            </div>
          </div>
          {tryOnBudgetLow && (
            <Button onClick={() => navigate("/pricing")} className="gradient-primary text-primary-foreground shadow-soft">
              {!widgetActivated ? "Activate widget" : "View plans"}
            </Button>
          )}
        </div>
        {tryOnBudgetLow && (
          <p className="text-sm text-muted-foreground mt-3">
            You&apos;ve used the try-ons included on your current plan.{" "}
            {!widgetActivated ? "Activate your widget or upgrade to continue." : "Upgrade for more capacity."}
          </p>
        )}
        {!credits && (
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">
            Couldn&apos;t load credit balance from the server. Check your connection or refresh the page.
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border border-border/50 p-5 shadow-card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
        <h3 className="font-display text-base font-semibold text-foreground mb-1">Daily Try-Ons</h3>
        <p className="text-xs text-muted-foreground mb-6">Last 7 days</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats?.weeklyData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(220 10% 46%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(220 10% 46%)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0 0% 100%)",
                  border: "1px solid hsl(220 13% 91%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area type="monotone" dataKey="tryOns" stroke="hsl(220 20% 10%)" fill="hsl(220 20% 10% / 0.08)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {stats?.totalTryOns === 0 && (
        <div className="mt-6 bg-muted/50 border border-border/50 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-foreground mb-1">No try-ons yet</p>
          <p className="text-sm text-muted-foreground mb-4">Use the Try-On Studio to generate your first AI virtual try-on.</p>
          <Button size="sm" className="gradient-primary text-primary-foreground shadow-soft" onClick={() => navigate('/studio')}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Open Try-On Studio
          </Button>
        </div>
      )}
    </motion.div>
  );
}
