import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getBrandAnalytics } from "@/lib/backendApi";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CHART_COLORS = ["hsl(220 20% 10%)", "hsl(220 20% 40%)", "hsl(220 20% 60%)", "hsl(220 13% 80%)"];

export function AnalyticsTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState({
    totalTryons: 0,
    completedTryons: 0,
    successRate: 0,
    creditsRemaining: 0,
    totalWidgetTryons: 0,
  });
  const [monthlyData, setMonthlyData] = useState<{ name: string; value: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const data = await getBrandAnalytics(days);

        setOverview({
          totalTryons: data.overview.totalTryons,
          completedTryons: data.overview.completedTryons,
          successRate: data.overview.successRate,
          creditsRemaining: data.overview.creditsRemaining,
          totalWidgetTryons: data.widgetEngagement.totalWidgetTryons,
        });

        const monthlyMap: Record<string, number> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthlyMap[key] = 0;
        }
        for (const day of data.dailyTrend) {
          const key = day.date.slice(0, 7);
          if (monthlyMap[key] !== undefined) {
            monthlyMap[key] += day.count;
          }
        }
        setMonthlyData(
          Object.entries(monthlyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => {
              const [y, m] = key.split("-");
              const monthIdx = parseInt(m, 10) - 1;
              return { name: `${MONTHS[monthIdx]} ${y.slice(2)}`, value };
            })
        );

        const cats = data.byCategory.map((c, i) => ({
          name: c.category.charAt(0).toUpperCase() + c.category.slice(1),
          value: c.count,
          color: CHART_COLORS[i % CHART_COLORS.length],
        }));
        setCategoryData(
          cats.length > 0 ? cats : [{ name: "No data", value: 1, color: CHART_COLORS[3] }]
        );
      } catch {
        setOverview({
          totalTryons: 0,
          completedTryons: 0,
          successRate: 0,
          creditsRemaining: 0,
          totalWidgetTryons: 0,
        });
        setMonthlyData([]);
        setCategoryData([{ name: "No data", value: 1, color: CHART_COLORS[3] }]);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [user, days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summaryCards = [
    { label: "Total Try-Ons", value: overview.totalTryons.toLocaleString() },
    { label: "Completed", value: overview.completedTryons.toLocaleString() },
    { label: "Success Rate", value: `${overview.successRate}%` },
    { label: "Widget Try-Ons", value: overview.totalWidgetTryons.toLocaleString() },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detailed insights into your try-on performance (last {days} days)
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border border-border/50 p-5 shadow-card"
          >
            <p className="font-display text-2xl font-bold text-foreground">{item.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 p-6 shadow-card">
          <h3 className="font-display text-base font-semibold text-foreground mb-1">
            Try-Ons Over Time
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            Daily try-on volume by month
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "hsl(220 10% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(220 10% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 100%)",
                    border: "1px solid hsl(220 13% 91%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="value" fill="hsl(220 20% 10%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border/50 p-6 shadow-card">
          <h3 className="font-display text-base font-semibold text-foreground mb-1">
            By Category
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Try-on distribution</p>
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {categoryData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-muted-foreground">{cat.name}</span>
                </div>
                <span className="font-medium text-foreground">{cat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {overview.totalTryons === 0 && (
        <div className="bg-muted/50 border border-border/50 rounded-xl p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No analytics data yet. Data will populate as shoppers use your try-on
            widget or Try-On Studio.
          </p>
        </div>
      )}
    </motion.div>
  );
}
