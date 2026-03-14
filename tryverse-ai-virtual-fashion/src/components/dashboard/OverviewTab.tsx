import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, TrendingUp, Users, Zap, Loader2, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  free_credits_remaining: number;
  free_credits_total: number;
  widget_activated: boolean;
}

export function OverviewTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [{ data: events }, { data: profileData }] = await Promise.all([
        supabase.from("usage_events").select("event_type, created_at").order("created_at", { ascending: true }),
        supabase.from("profiles").select("free_credits_remaining, free_credits_total, widget_activated").eq("id", user.id).single(),
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
      setProfile(profileData as unknown as Profile);
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

  const creditsRemaining = profile?.free_credits_remaining ?? 3;
  const creditsTotal = profile?.free_credits_total ?? 3;
  const widgetActivated = profile?.widget_activated ?? false;

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

      {/* Credits Banner */}
      <div className={`rounded-xl border p-5 mb-8 ${creditsRemaining > 0 ? "border-border/50 bg-card" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${creditsRemaining > 0 ? "gradient-primary shadow-soft" : "bg-destructive/10"}`}>
              <Sparkles className={`h-5 w-5 ${creditsRemaining > 0 ? "text-primary-foreground" : "text-destructive"}`} />
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-foreground">Free AI Try-On Credits</p>
              <p className="text-lg font-bold text-foreground">{creditsRemaining} / {creditsTotal} <span className="text-sm font-normal text-muted-foreground">Remaining</span></p>
            </div>
          </div>
          {creditsRemaining === 0 && !widgetActivated && (
            <Button onClick={() => navigate("/pricing")} className="gradient-primary text-primary-foreground shadow-soft">
              Activate Widget
            </Button>
          )}
        </div>
        {creditsRemaining === 0 && !widgetActivated && (
          <p className="text-sm text-muted-foreground mt-3">
            You've used your free TryVerse tests. Activate your widget to continue using AI try-ons.
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
