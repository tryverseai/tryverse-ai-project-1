import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Eye, LayoutGrid, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getMyCreations, deleteCreation, type Creation, type CreationType } from "@/lib/backendApi";
import { EmptyState } from "@/components/EmptyState";
import { Lightbox } from "@/components/Lightbox";
import { downloadFile, dateStampedFilename } from "@/lib/utils";

const TYPE_LABELS: Record<CreationType, string> = {
  tryon: "Try-On",
  outfit: "Outfit Builder",
  product_model: "Product Photography",
  photoshoot: "AI Photoshoot",
  video: "AI Video",
  ai_model: "AI Model Studio",
};

export function MyCreationsTab() {
  const [creations, setCreations] = useState<Creation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CreationType | "all">("all");
  const [viewing, setViewing] = useState<Creation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Creation | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyCreations()
      .then((rows) => { if (!cancelled) setCreations(rows); })
      .catch(() => { if (!cancelled) toast.error("Could not load your creations"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setDeleting(true);
    try {
      await deleteCreation(target.type, target.id);
      setCreations((prev) => prev.filter((c) => !(c.id === target.id && c.type === target.type)));
      toast.success("Deleted");
      setConfirmDelete(null);
    } catch (e) {
      toast.error("Could not delete this", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = filter === "all" ? creations : creations.filter((c) => c.type === filter);
  const availableTypes = Array.from(new Set(creations.map((c) => c.type)));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            My Creations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything you've generated across TryVerse, in one place. Stays here across devices and sessions.
          </p>
        </div>
      </div>

      {availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          {availableTypes.map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t)}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-sm text-muted-foreground">Loading your creations…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No creations yet"
          description="Results from Try-On, Outfit Builder, AI Photoshoot, AI Video, and AI Models will show up here once you generate something."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <div
              key={`${c.type}-${c.id}`}
              className="rounded-xl overflow-hidden border border-border/50 bg-card group relative"
            >
              <div className="aspect-[3/4] bg-muted">
                {c.resultUrl ? (
                  c.isVideo ? (
                    <video src={c.resultUrl} className="w-full h-full object-cover" muted loop playsInline />
                  ) : (
                    <img
                      src={c.resultUrl}
                      alt={TYPE_LABELS[c.type]}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  )
                ) : null}
              </div>
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium">
                {TYPE_LABELS[c.type]}
              </div>
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  title="View full size"
                  onClick={() => setViewing(c)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  title="Download"
                  onClick={() =>
                    c.resultUrl &&
                    void downloadFile(c.resultUrl, dateStampedFilename(`tryverse-${c.type}`, c.isVideo ? "mp4" : "jpg")).catch(() =>
                      toast.error("Download failed")
                    )
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 text-destructive"
                  title="Delete"
                  onClick={() => setConfirmDelete(c)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Lightbox
        open={viewing !== null}
        onOpenChange={(open) => !open && setViewing(null)}
        url={viewing?.resultUrl ?? null}
        isVideo={viewing?.isVideo}
        title={viewing ? TYPE_LABELS[viewing.type] : undefined}
        downloadFilename={viewing ? dateStampedFilename(`tryverse-${viewing.type}`, viewing.isVideo ? "mp4" : "jpg") : undefined}
      />

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this creation?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from My Creations permanently. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
