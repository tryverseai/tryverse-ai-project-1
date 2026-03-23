import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Images, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAdminModelLibrary, type TryverseModel } from "@/lib/backendApi";
import { toast } from "sonner";

type Row = TryverseModel & { is_active: boolean; created_at: string };

export function AdminModelLibraryTab({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminModelLibrary(adminKey);
      setRows(res.models || []);
    } catch {
      toast.error("Failed to load model library");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Images className="h-7 w-7" />
            Model library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preset faces for Try-On Studio and the embed widget (when brands enable “Show AI Model Selection”). Edit rows in
            Supabase table <code className="text-xs bg-muted px-1 rounded">tryverse_model_library</code>. After SQL updates, tap{" "}
            <strong>Refresh</strong> — data is loaded fresh (no CDN cache on this API).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-center py-16">No rows returned. Apply migration and seed, or check admin API.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="aspect-[3/4] bg-muted relative">
                <img
                  src={`${m.image_url}${m.image_url.includes("?") ? "&" : "?"}tryverse_slug=${encodeURIComponent(m.slug)}`}
                  alt={m.display_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <Badge variant={m.is_active ? "default" : "secondary"} className="text-[10px]">
                    {m.is_active ? "active" : "inactive"}
                  </Badge>
                </div>
              </div>
              <div className="p-3 space-y-1">
                <p className="font-semibold text-foreground">{m.display_name}</p>
                <p className="text-[10px] font-mono text-muted-foreground truncate" title={m.slug}>
                  {m.slug}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </motion.div>
  );
}
