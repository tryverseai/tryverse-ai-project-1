import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  Sparkles,
  Users,
  TrendingUp,
  Code,
  ExternalLink,
  AlertCircle,
  BarChart3,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getPersonalizeAnalytics, widgetBackendPublicUrl } from "@/lib/backendApi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Snippet builders ──────────────────────────────────────────────────────────

const getScriptBase = () =>
  (typeof window !== "undefined" ? window.location.origin : "") ||
  import.meta.env.VITE_APP_URL ||
  "https://tryverseai.com";

function buildInitSnippet(apiKey: string) {
  const backend = widgetBackendPublicUrl();
  const scriptBase = getScriptBase();
  return `<!-- Add once to your storefront <head> or before </body> -->
<script src="${scriptBase}/tryverse-personalize.js"></script>
<script>
  TryVersePersonalize.init({
    apiKey: '${apiKey}',
    backendUrl: '${backend}'
  });
</script>`;
}

function buildMarkupSnippet() {
  return `<!-- Mark each product image you want personalized -->
<img
  src="https://yourstore.com/product-shot.jpg"
  data-tv-personalize="true"
  data-tv-product-id="sku-12345"
  alt="Blue Linen Dress"
/>`;
}

// ── Analytics fetch ───────────────────────────────────────────────────────────

interface DailyStat { date: string; generations: number }
interface AnalyticsData {
  totalGenerations: number;
  enabled: boolean;
  dailyBreakdown: DailyStat[];
}

async function fetchAnalytics(days: number): Promise<AnalyticsData> {
  const data = await getPersonalizeAnalytics(days);
  return data;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? "Copy"}
    </Button>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-muted/40">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/60">
        <span className="text-xs text-muted-foreground font-medium">{label ?? "HTML"}</span>
        <CopyButton value={code} />
      </div>
      <pre className="p-4 text-xs leading-relaxed overflow-x-auto text-foreground/90 font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex gap-4 items-center">
      <div className="rounded-lg bg-muted p-2.5">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PersonalizeTab() {
  const { user: _user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [activeSection, setActiveSection] = useState<"setup" | "analytics">("setup");

  useEffect(() => {
    if (activeSection !== "analytics") return;
    setLoadingAnalytics(true);
    fetchAnalytics(analyticsPeriod)
      .then(setAnalytics)
      .catch(() => toast.error("Could not load analytics"))
      .finally(() => setLoadingAnalytics(false));
  }, [activeSection, analyticsPeriod]);

  const initSnippet = buildInitSnippet("YOUR_API_KEY");

  const chartData = analytics?.dailyBreakdown
    .slice(-14)
    .map((d) => ({ date: d.date.slice(5), g: d.generations })) ?? [];

  const totalLabel = analytics?.totalGenerations ?? "—";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-foreground" />
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            AI Model Personalization
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Let shoppers upload one photo and see themselves replacing the models across your
          entire product catalogue — same clothing, same styling, their face.
        </p>
      </div>

      {/* Feature highlight */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-gradient-to-br from-foreground/[0.03] to-transparent p-5 space-y-3"
      >
        <p className="text-sm font-semibold text-foreground">What shoppers see</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              step: "1",
              title: "Shopper clicks",
              desc: '"See yourself as the model" button on your site',
            },
            {
              step: "2",
              title: "One photo upload",
              desc: "Selfie or portrait — no account required",
            },
            {
              step: "3",
              title: "Personalized catalog",
              desc: "Every product shows the shopper as the model — with a toggle to compare",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
                {item.step}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {(["setup", "analytics"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSection(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              activeSection === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "setup" ? "Integration" : "Analytics"}
          </button>
        ))}
      </div>

      {/* ── SETUP SECTION ───────────────────────────────────────────────────── */}
      {activeSection === "setup" && (
        <motion.div
          key="setup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
                1
              </div>
              <p className="text-sm font-semibold text-foreground">Add the script to your storefront</p>
            </div>
            <p className="text-xs text-muted-foreground ml-8">
              Paste this once inside <code className="text-foreground">&lt;head&gt;</code> or before{" "}
              <code className="text-foreground">&lt;/body&gt;</code>. Replace the API key if needed.
            </p>
            <div className="ml-8 flex items-start gap-2 rounded-lg bg-muted/60 border border-border p-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Replace <code className="text-foreground font-mono">YOUR_API_KEY</code> with your
                actual key from the <strong>API Keys</strong> tab.
              </p>
            </div>
            <div className="ml-8">
              <CodeBlock code={initSnippet} label="HTML / JavaScript" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
                2
              </div>
              <p className="text-sm font-semibold text-foreground">Mark your product images</p>
            </div>
            <p className="text-xs text-muted-foreground ml-8">
              Add <code className="text-foreground">data-tv-personalize="true"</code> to every product
              image you want personalized. Optionally pass a unique{" "}
              <code className="text-foreground">data-tv-product-id</code> for better caching.
            </p>
            <div className="ml-8">
              <CodeBlock code={buildMarkupSnippet()} label="Product image markup" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">
                3
              </div>
              <p className="text-sm font-semibold text-foreground">That's it — test your integration</p>
            </div>
            <div className="ml-8 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-fit"
                onClick={() => window.open("https://docs.tryverseai.com/personalize", "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Full documentation
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-fit"
                onClick={() => window.open("https://tryverseai.com/demo/personalize", "_blank")}
              >
                <Sparkles className="h-3.5 w-3.5" />
                See live demo
              </Button>
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-xl border border-border p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">How it works</p>
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground list-none">
              {[
                "Shopper uploads a photo → a 7-day anonymous session is created (no account required)",
                "The widget replaces marked product images on demand — only images the shopper actually views",
                "Results are cached: the same product is never regenerated for the same session",
                "Sessions and generated images expire automatically after 7 days",
                "All AI generation happens server-side — your infrastructure is never exposed to shoppers",
                "The shopper can toggle between original and personalized views at any time",
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-foreground/30 shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Powered by */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-4 py-3">
            <Code className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Powered by TryVerse's AI model-personalization engine — the same infrastructure behind
              every generation on the platform.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── ANALYTICS SECTION ───────────────────────────────────────────────── */}
      {activeSection === "analytics" && (
        <motion.div
          key="analytics"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Period selector */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Personalization usage</p>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setAnalyticsPeriod(d)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    analyticsPeriod === d
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={Sparkles}
              label={`Total generations (${analyticsPeriod}d)`}
              value={loadingAnalytics ? "…" : totalLabel}
            />
            <StatCard
              icon={Users}
              label="Feature status"
              value={
                analytics === null
                  ? "…"
                  : analytics.enabled
                  ? "Active"
                  : "Not configured"
              }
            />
          </div>

          {/* Not configured notice */}
          {analytics && !analytics.enabled && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Not configured yet
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  AI Model Personalization isn't active on this account yet. Contact support to turn
                  it on.
                </p>
              </div>
            </div>
          )}

          {/* Chart */}
          {loadingAnalytics ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 rounded-full border-2 border-muted border-t-foreground animate-spin" />
            </div>
          ) : chartData.length > 0 && chartData.some((d) => d.g > 0) ? (
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Daily generations</p>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="g" fill="hsl(var(--foreground))" radius={[4, 4, 0, 0]} name="Generations" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 gap-3 text-center px-6">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No generations yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Once shoppers start using the personalization widget on your store, usage will appear
                here.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
