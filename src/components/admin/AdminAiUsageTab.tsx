import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Cpu, Loader2, Crown } from "lucide-react";
import { getAdminAiUsage, type AdminAiUsage } from "@/lib/backendApi";

interface AdminAiUsageTabProps {
  adminKey: string;
}

const FEATURE_LABELS: Record<string, string> = {
  ai_model: "AI Model Studio",
  ai_photoshoot: "AI Photoshoot",
  outfit_builder: "Outfit Builder",
  product_model: "Product Photography",
  video: "AI Video",
};

function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature;
}

export function AdminAiUsageTab({ adminKey }: AdminAiUsageTabProps) {
  const [data, setData] = useState<AdminAiUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAdminAiUsage(adminKey, 100)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [adminKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Could not load AI usage data</div>;
  }

  const featureEntries = Object.entries(data.byFeature || {}).sort((a, b) => b[1] - a[1]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <p className="text-sm text-muted-foreground -mt-2">
        Enterprise/unlimited-plan accounts don't draw down a visible credit balance, so this is the
        only place their AI generation activity is observable.
      </p>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Cpu className="h-4 w-4" />
            <span className="text-xs font-medium">Total Generations</span>
          </div>
          <p className="text-xl font-bold text-foreground">{data.totalGenerations.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">All time, all features</p>
        </div>
        {featureEntries.slice(0, 3).map(([feature, count]) => (
          <div key={feature} className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Cpu className="h-4 w-4" />
              <span className="text-xs font-medium">{featureLabel(feature)}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{count.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Per-user breakdown */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <h3 className="font-display text-lg font-semibold text-foreground px-5 py-4 border-b border-border">
          By account
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Account</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Plan</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Total</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">By feature</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Last used</th>
              </tr>
            </thead>
            <tbody>
              {data.perUser.map((u) => (
                <tr key={u.userId} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium">{u.brandName || u.contactEmail || u.userId}</p>
                    {u.brandName && u.contactEmail && (
                      <p className="text-xs text-muted-foreground">{u.contactEmail}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                        u.planId === "enterprise"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.planId === "enterprise" && <Crown className="h-3 w-3" />}
                      {u.planId}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium">{u.total.toLocaleString()}</td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {Object.entries(u.byFeature)
                      .map(([f, c]) => `${featureLabel(f)}: ${c}`)
                      .join(" · ")}
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    {u.lastUsed ? new Date(u.lastUsed).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.perUser.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No AI generation usage recorded yet</div>
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <h3 className="font-display text-lg font-semibold text-foreground px-5 py-4 border-b border-border">
          Recent activity
        </h3>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Account</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Feature</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-4 text-sm text-muted-foreground">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-5 py-4 text-sm">{r.brandName || r.userId}</td>
                  <td className="px-5 py-4 text-sm">{featureLabel(r.feature)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.recent.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No recent activity</div>
        )}
      </div>
    </motion.div>
  );
}
