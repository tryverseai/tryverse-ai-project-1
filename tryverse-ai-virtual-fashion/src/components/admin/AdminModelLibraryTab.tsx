import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Images, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAdminModelLibrary, patchAdminModelLibrary, type TryverseModel } from "@/lib/backendApi";
import { toast } from "sonner";

type Row = TryverseModel & { is_active: boolean; free_tier_eligible: boolean; created_at: string };

export function AdminModelLibraryTab({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [patchingId, setPatchingId] = useState<string | null>(null);

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

  const patch = async (id: string, body: { is_active?: boolean; free_tier_eligible?: boolean }) => {
    setPatchingId(id);
    try {
      await patchAdminModelLibrary(adminKey, id, body);
      toast.success("Model updated");
      await load();
    } catch {
      toast.error("Could not update model");
    } finally {
      setPatchingId(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Images className="h-7 w-7" />
            Model library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>In catalog</strong> shows the preset to shoppers. <strong>Free tier</strong> lets users on the free plan
            run try-ons with that preset (default: Diane + Andrew). Paid plans may use any in-catalog model.
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
        <p className="text-muted-foreground text-center py-16">No rows returned. Seed the model library or check the admin API.</p>
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
                <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                  <Badge variant={m.is_active ? "default" : "secondary"} className="text-[10px]">
                    {m.is_active ? "in catalog" : "hidden"}
                  </Badge>
                  <Badge variant={m.free_tier_eligible ? "outline" : "secondary"} className="text-[10px] bg-background/90">
                    {m.free_tier_eligible ? "free tier" : "paid only"}
                  </Badge>
                </div>
                {patchingId === m.id && (
                  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                  </div>
                )}
              </div>
              <div className="p-3 space-y-3 border-t border-border/60">
                <div>
                  <p className="font-semibold text-foreground">{m.display_name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate" title={m.slug}>
                    {m.slug}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`active-${m.id}`} className="text-xs text-muted-foreground cursor-pointer">
                    In catalog
                  </Label>
                  <Switch
                    id={`active-${m.id}`}
                    checked={m.is_active}
                    disabled={patchingId === m.id}
                    onCheckedChange={(v) => void patch(m.id, { is_active: v })}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`free-${m.id}`} className="text-xs text-muted-foreground cursor-pointer">
                    Free tier OK
                  </Label>
                  <Switch
                    id={`free-${m.id}`}
                    checked={m.free_tier_eligible}
                    disabled={patchingId === m.id || !m.is_active}
                    onCheckedChange={(v) => void patch(m.id, { free_tier_eligible: v })}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </motion.div>
  );
}
