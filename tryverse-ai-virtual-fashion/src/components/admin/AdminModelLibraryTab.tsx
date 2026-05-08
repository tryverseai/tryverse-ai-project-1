import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Images, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ApiError,
  getAdminModelLibrary,
  patchAdminModelLibrary,
  postAdminModelLibraryBulkFreeTier,
  type TryverseModel,
} from "@/lib/backendApi";
import { toast } from "sonner";

type Row = TryverseModel & { is_active: boolean; free_tier_eligible: boolean; created_at: string };

export function AdminModelLibraryTab({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

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
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not update model";
      toast.error(msg);
    } finally {
      setPatchingId(null);
    }
  };

  const bulkFreeTier = async (mode: "all_in_catalog" | "defaults_only" | "all_rows") => {
    const ok =
      mode === "all_in_catalog"
        ? confirm(
            "Unlock every in-catalog preset for Free-plan users? (They still need try-on credits.)"
          )
        : mode === "all_rows"
          ? confirm(
              "TESTING: Set EVERY model row to “unlocked for Free plan” (including hidden/inactive rows). Continue?"
            )
          : confirm(
              "Restrict Free-plan users to Diane + Andrew only? (Paid plans keep full in-catalog access.)"
            );
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await postAdminModelLibraryBulkFreeTier(adminKey, mode);
      toast.success(
        mode === "all_in_catalog"
          ? `Unlocked ${res.updated} preset row(s) for Free tier`
          : mode === "all_rows"
            ? `Testing unlock: updated ${res.updated} row(s) — all marked free-tier eligible`
            : `Reset Free tier to defaults (${res.updated} row(s) updated)`
      );
      await load();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Bulk update failed";
      toast.error(msg);
    } finally {
      setBulkBusy(false);
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
            <strong>In catalog</strong> shows the preset in the app and widget. <strong>Unlocked for Free plan</strong> means
            users on Free / trial can select that preset when they have try-on credits. Paid plans can use any in-catalog
            preset. Changes apply immediately in the user dashboard (Try on / Models tabs).
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={loading || bulkBusy}
              onClick={() => void bulkFreeTier("all_in_catalog")}
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Unlock all in-catalog for Free plan
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={loading || bulkBusy}
              onClick={() => void bulkFreeTier("defaults_only")}
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Free plan: Diane + Andrew only
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-2"
              disabled={loading || bulkBusy}
              onClick={() => void bulkFreeTier("all_rows")}
            >
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Testing: unlock every model row
            </Button>
          </div>
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
                    {m.free_tier_eligible ? "unlocked (Free plan)" : "paid plan only"}
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
                    Unlocked for Free plan
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
