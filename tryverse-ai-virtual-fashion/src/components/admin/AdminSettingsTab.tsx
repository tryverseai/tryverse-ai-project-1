import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Loader2, ToggleLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminSettings } from "@/lib/backendApi";

interface AdminSettingsTabProps {
  adminKey: string;
}

export function AdminSettingsTab({ adminKey }: AdminSettingsTabProps) {
  const [data, setData] = useState<{
    featureFlags: Record<string, boolean>;
    queue: { concurrency: number; timeoutMs: number; maxRetries: number };
    replicate?: { modelClothing: string; modelAccessories: string; modelRembg: string };
    plans?: Array<{ id: string; name: string; tryons_per_month: number; max_products: number; price_ngn: number; price_usd: number }>;
    maintenanceMode: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = () => {
    setLoading(true);
    setError(null);
    getAdminSettings(adminKey)
      .then((d) => setData(d))
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Failed to load settings");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettings();
  }, [adminKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
            <Info className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{error || "Failed to load settings"}</p>
              <p className="text-sm mt-1">Check ADMIN_SECRET_KEY and backend connectivity.</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSettings}>Retry</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  const featureFlags = data.featureFlags ?? {};
  const queue = data.queue ?? { concurrency: 0, timeoutMs: 0, maxRetries: 0 };

  const flags = [
    { key: "enableBackgroundRemoval", label: "Background removal", desc: "Remove background from product images before try-on" },
    { key: "enableFacePreservation", label: "Face preservation (GFPGAN)", desc: "Replicate GFPGAN — alters face; usually off when face lock is on" },
    { key: "enableFaceLock", label: "Face lock (clothing)", desc: "Paste input face onto IDM-VTON output (BlazeFace + Sharp compositing)" },
    { key: "enablePostProcessing", label: "Post-processing", desc: "Color/lighting correction with Sharp" },
    { key: "enableImageModeration", label: "Image moderation", desc: "Hive content moderation (requires HIVE_API_KEY)" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bg-card rounded-xl border border-border/50 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold text-foreground">Feature flags</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          These are read from environment variables. Update backend .env and restart to change.
        </p>
        <div className="space-y-4">
          {flags.map((f) => (
            <div key={f.key} className="flex items-center justify-between p-4 rounded-lg border border-border/50">
              <div>
                <p className="font-medium text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${(featureFlags as Record<string, boolean>)[f.key] ? "text-green-600" : "text-muted-foreground"}`}>
                  {(featureFlags as Record<string, boolean>)[f.key] ? "On" : "Off"}
                </span>
                <ToggleLeft className={`h-6 w-6 ${(featureFlags as Record<string, boolean>)[f.key] ? "text-green-600" : "text-muted-foreground"}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold text-foreground">Queue settings</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Concurrency</p>
            <p className="text-xl font-bold text-foreground">{queue.concurrency}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Timeout (ms)</p>
            <p className="text-xl font-bold text-foreground">{queue.timeoutMs.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Max retries</p>
            <p className="text-xl font-bold text-foreground">{queue.maxRetries}</p>
          </div>
        </div>
      </div>

      {(data.plans?.length ?? 0) > 0 && (
        <div className="bg-card rounded-xl border border-border/50 p-6 mb-6">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">Plan limits</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Plan</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Try-ons/mo</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Products</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Price (NGN)</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Price (USD)</th>
                </tr>
              </thead>
              <tbody>
                {data.plans!.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-3 font-medium capitalize">{p.name}</td>
                    <td className="py-3">{p.tryons_per_month === -1 ? "Unlimited" : p.tryons_per_month}</td>
                    <td className="py-3">{p.max_products === -1 ? "Unlimited" : p.max_products}</td>
                    <td className="py-3">₦{p.price_ngn.toLocaleString()}</td>
                    <td className="py-3">${p.price_usd.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.replicate && (
        <div className="bg-card rounded-xl border border-border/50 p-6 mb-6">
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">AI provider (Replicate)</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Clothing:</span> {data.replicate.modelClothing}</p>
            <p><span className="text-muted-foreground">Accessories:</span> {data.replicate.modelAccessories}</p>
            <p><span className="text-muted-foreground">Background removal:</span> {data.replicate.modelRembg}</p>
          </div>
        </div>
      )}

      {data.maintenanceMode && (
        <div className="mt-6 p-4 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-3">
          <Info className="h-5 w-5" />
          <p className="text-sm font-medium">Maintenance mode is enabled.</p>
        </div>
      )}
    </motion.div>
  );
}
