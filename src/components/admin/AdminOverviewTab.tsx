import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Zap, CreditCard, BarChart3, Loader2, Activity, CheckCircle, XCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getAdminMetrics, getAdminHealth, getAdminActivity } from "@/lib/backendApi";

interface AdminOverviewTabProps {
  adminKey: string;
}

export function AdminOverviewTab({ adminKey }: AdminOverviewTabProps) {
  const [data, setData] = useState<{
    users: { total: number };
    tryons: { total: number; today: number; thisMonth: number; successRate: number };
    subscriptions: { active: number };
    revenue: { ngn: number; usd: number; totalPayments: number };
    usageOverTime?: { date: string; tryons: number; newUsers: number }[];
  } | null>(null);
  const [health, setHealth] = useState<{ api: { status: string }; queue: { status: string; message?: string }; ai: { status: string; message?: string } } | null>(null);
  const [activity, setActivity] = useState<{ items: Array<{ id: string; type: string; brand: string; status: string; category: string; createdAt: string }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [m, h, a] = await Promise.all([
          getAdminMetrics(adminKey),
          getAdminHealth(adminKey).catch(() => null),
          getAdminActivity(adminKey).catch(() => null),
        ]);
        setData(m);
        setHealth(h);
        setActivity(a);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [adminKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { label: "Total users", value: data.users.total.toLocaleString(), icon: Users },
    { label: "AI requests (try-ons)", value: data.tryons.total.toLocaleString(), sub: `${data.tryons.today} today · ${data.tryons.thisMonth} this month · ${data.tryons.successRate}% success`, icon: Zap },
    { label: "Active subscriptions", value: data.subscriptions.active.toString(), icon: CreditCard },
    { label: "Revenue", value: `₦${data.revenue.ngn.toLocaleString()} / $${data.revenue.usd.toLocaleString()}`, sub: `${data.revenue.totalPayments} payments`, icon: BarChart3 },
  ];

  const chartData = (data.usageOverTime || []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Metrics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <c.icon className="h-4 w-4" />
              <span className="text-xs font-medium">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
            {c.sub && <p className="text-xs text-muted-foreground mt-1 truncate">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* System health */}
      {health && (
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <h3 className="font-display text-base font-semibold text-foreground mb-3">System health</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {health.api?.status === "healthy" ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm">API</span>
            </div>
            <div className="flex items-center gap-2">
              {health.queue?.status === "healthy" ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-amber-600" aria-label={health.queue?.message ?? "Queue unhealthy"} />
              )}
              <span className="text-sm">Queue</span>
            </div>
            <div className="flex items-center gap-2">
              {health.ai?.status === "configured" ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" aria-label={health.ai?.message ?? "AI unavailable"} />
              )}
              <span className="text-sm">AI</span>
            </div>
          </div>
        </div>
      )}

      {/* Usage chart - clean, single focus */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <h3 className="font-display text-base font-semibold text-foreground mb-4">AI requests per day (30 days)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(value: number) => [value, "Try-ons"]}
                  labelFormatter={(l) => l}
                />
                <Area type="monotone" dataKey="tryons" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" strokeWidth={2} name="Try-ons" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity feed */}
      {activity && activity.items.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-5">
          <h3 className="font-display text-base font-semibold text-foreground mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent activity
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {activity.items.slice(0, 15).map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 text-sm">
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{item.brand}</strong> generated a try-on
                  {item.category && ` (${item.category})`}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  item.status === "completed" ? "bg-green-500/20 text-green-600" :
                  item.status === "failed" ? "bg-destructive/20 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
