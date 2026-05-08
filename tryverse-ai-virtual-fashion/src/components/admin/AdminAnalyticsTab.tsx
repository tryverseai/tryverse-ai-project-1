import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Zap, Users, TrendingUp, Loader2, RefreshCw, BarChart3, Filter } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  postHogQuery,
  isPostHogApiConfigured,
  hogqlDateFilter,
} from "@/lib/posthogApi";

interface AdminAnalyticsTabProps {
  adminKey: string;
}

type DateRange = "today" | "7d" | "30d" | "all";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

const TRACKED_EVENTS = [
  "try_on_started",
  "try_on_completed",
  "try_on_failed",
  "user_signed_up",
  "user_logged_in",
  "brand_page_viewed",
  "upload_photo_clicked",
  "download_result_clicked",
];

export function AdminAnalyticsTab({ adminKey: _adminKey }: AdminAnalyticsTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [eventFilter, setEventFilter] = useState<string>("all");

  const [overview, setOverview] = useState<{
    totalTryOns: number;
    tryOnsToday: number;
    successRate: number;
    totalSignedUp: number;
  } | null>(null);
  const [tryOnsOverTime, setTryOnsOverTime] = useState<{ date: string; count: number }[]>([]);
  const [funnel, setFunnel] = useState<{ step: string; count: number }[]>([]);
  const [activeHours, setActiveHours] = useState<{ hour: string; count: number }[]>([]);
  const [recentEvents, setRecentEvents] = useState<
    { event: string; distinct_id: string; timestamp: string; properties: Record<string, unknown> }[]
  >([]);

  const dateFilter = hogqlDateFilter(dateRange);

  const fetchData = useCallback(async () => {
    if (!isPostHogApiConfigured()) {
      setError(
        "PostHog API not configured. Locally: add VITE_POSTHOG_PROJECT_ID and VITE_POSTHOG_PERSONAL_API_KEY to .env — for production (e.g. Vercel): set the same names as Environment Variables, then redeploy."
      );
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const eventFilterSql =
        eventFilter === "all"
          ? ""
          : ` AND event = '${eventFilter.replace(/'/g, "''")}'`;

      const [totalTryOnsRes, todayRes, completedRes, failedRes, signedUpRes, overTimeRes, funnelRes, hoursRes, eventsRes] =
        await Promise.all([
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT count() as cnt FROM events WHERE event IN ('try_on_started', 'try_on_completed')`,
            },
            "total_tryons"
          ),
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT count() as cnt FROM events WHERE event IN ('try_on_started', 'try_on_completed') AND ${dateFilter}`,
            },
            "tryons_today"
          ),
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT count() as cnt FROM events WHERE event = 'try_on_completed' AND ${dateFilter}`,
            },
            "completed"
          ),
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT count() as cnt FROM events WHERE event = 'try_on_failed' AND ${dateFilter}`,
            },
            "failed"
          ),
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT count() as cnt FROM events WHERE event = 'user_signed_up'`,
            },
            "signed_up"
          ),
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT toDate(timestamp) as d, count() as cnt FROM events WHERE event IN ('try_on_started', 'try_on_completed') AND timestamp >= now() - INTERVAL 30 DAY GROUP BY d ORDER BY d`,
            },
            "tryons_over_time"
          ),
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT event as e, count() as cnt FROM events WHERE event IN ('upload_photo_clicked', 'try_on_started', 'try_on_completed') AND ${dateFilter} GROUP BY e`,
            },
            "funnel"
          ),
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT toHour(timestamp) as h, count() as cnt FROM events WHERE event IN ('try_on_started', 'try_on_completed') AND ${dateFilter} GROUP BY h ORDER BY h`,
            },
            "active_hours"
          ),
          postHogQuery(
            {
              kind: "HogQLQuery",
              query: `SELECT event, distinct_id, timestamp, properties FROM events WHERE 1=1${eventFilterSql} ORDER BY timestamp DESC LIMIT 50`,
            },
            "recent_events"
          ),
        ]);

      const getCount = (r: { results?: unknown[][] }) => Number(r.results?.[0]?.[0] ?? 0);

      const totalTryOns = getCount(totalTryOnsRes);
      const tryOnsToday = getCount(todayRes);
      const completed = getCount(completedRes);
      const failed = getCount(failedRes);
      const total = completed + failed;
      const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const totalSignedUp = getCount(signedUpRes);

      setOverview({ totalTryOns, tryOnsToday, successRate, totalSignedUp });

      const overTimeData = (overTimeRes.results || []).map((row: unknown[]) => ({
        date: new Date(row[0] as string).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: Number(row[1] ?? 0),
      }));
      setTryOnsOverTime(overTimeData);

      const funnelOrder = ["upload_photo_clicked", "try_on_started", "try_on_completed"];
      const funnelMap = new Map(
        (funnelRes.results || []).map((row: unknown[]) => [String(row[0]), Number(row[1] ?? 0)])
      );
      setFunnel(
        funnelOrder.map((step) => ({
          step: step.replace(/_/g, " "),
          count: funnelMap.get(step) ?? 0,
        }))
      );

      const hoursMap = new Map(
        (hoursRes.results || []).map((row: unknown[]) => [Number(row[0]), Number(row[1] ?? 0)])
      );
      const hoursData = Array.from({ length: 24 }, (_, i) => ({
        hour: `${i}:00`,
        count: hoursMap.get(i) ?? 0,
      }));
      setActiveHours(hoursData);

      const cols = (eventsRes as { columns?: string[] }).columns || ["event", "distinct_id", "timestamp", "properties"];
      const eventsData = (eventsRes.results || []).map((row: unknown[]) => {
        const obj: Record<string, unknown> = {};
        cols.forEach((c, i) => {
          obj[c] = row[i];
        });
        return obj;
      }).map((o) => ({
        event: String(o.event ?? ""),
        distinct_id: String(o.distinct_id ?? ""),
        timestamp: String(o.timestamp ?? ""),
        properties: (typeof o.properties === "object" && o.properties !== null ? o.properties : {}) as Record<string, unknown>,
      }));
      setRecentEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [dateRange, eventFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!isPostHogApiConfigured()) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            PostHog Analytics requires configuration. Add these to local <code className="bg-muted px-1 rounded">.env</code> or
            your host&apos;s env (production: e.g. Vercel project settings — then redeploy):
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            VITE_POSTHOG_PROJECT_ID=your_project_id
            <br />
            VITE_POSTHOG_PERSONAL_API_KEY=your_personal_api_key
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Use Profile → Personal API Keys (needs query/HogQL read access). Do not paste the browser <code className="font-mono">phc_*</code> project token — it returns 403. EU projects should set{" "}
            <code className="font-mono">VITE_POSTHOG_HOST=https://eu.i.posthog.com</code>.
          </p>
        </div>
      </motion.div>
    );
  }

  if (loading && !overview) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Date range:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="rounded-lg border border-black bg-black text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black [&>option]:bg-black [&>option]:text-white"
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Event type:</span>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded-lg border border-black bg-black text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-black [&>option]:bg-black [&>option]:text-white"
          >
            <option value="all">All events</option>
            {TRACKED_EVENTS.map((e) => (
              <option key={e} value={e}>
                {e.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium">Total Try-Ons</span>
          </div>
          <p className="text-xl font-bold text-foreground">{(overview?.totalTryOns ?? 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">All time</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium">Try-Ons Today</span>
          </div>
          <p className="text-xl font-bold text-foreground">{(overview?.tryOnsToday ?? 0).toLocaleString()}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Success Rate</span>
          </div>
          <p className="text-xl font-bold text-foreground">{overview?.successRate ?? 0}%</p>
          <p className="text-xs text-muted-foreground mt-1">Completed vs failed</p>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Total Signed Up Users</span>
          </div>
          <p className="text-xl font-bold text-foreground">{(overview?.totalSignedUp ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Line chart - Try-ons over 30 days */}
      {tryOnsOverTime.length > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <h3 className="font-display text-base font-semibold text-foreground mb-4">Try-ons over the last 30 days</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tryOnsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [value, "Try-ons"]}
                />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Funnel + Bar chart row */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <h3 className="font-display text-base font-semibold text-foreground mb-4">
            Funnel: upload_photo_clicked → try_on_started → try_on_completed
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="step" tick={{ fontSize: 11 }} width={120} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <h3 className="font-display text-base font-semibold text-foreground mb-4">Most active hours of the day</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activeHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [value, "Events"]}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  {activeHours.map((entry, i) => (
                    <Cell key={i} fill={entry.count > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent events table */}
      <div className="bg-card rounded-xl border border-border/50 p-6">
        <h3 className="font-display text-base font-semibold text-foreground mb-4 flex items-center justify-between">
          Recent Events (last 50)
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </h3>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Event Name</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">User ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Timestamp</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Properties</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No events found
                  </td>
                </tr>
              ) : (
                recentEvents.map((evt, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-2 font-medium">{evt.event}</td>
                    <td className="px-3 py-2 font-mono text-xs truncate max-w-[120px]">{evt.distinct_id}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <pre className="text-xs text-muted-foreground overflow-x-auto max-w-xs whitespace-pre-wrap break-words">
                        {JSON.stringify(evt.properties || {})}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
