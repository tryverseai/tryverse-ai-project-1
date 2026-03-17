import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Cpu, Pause, Play, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminQueue, pauseAdminQueue, resumeAdminQueue } from "@/lib/backendApi";
import { toast } from "sonner";

interface AdminQueueTabProps {
  adminKey: string;
}

export function AdminQueueTab({ adminKey }: AdminQueueTabProps) {
  const [data, setData] = useState<{
    status: string;
    counts?: { waiting: number; active: number; completed: number; failed: number; delayed: number };
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pausing, setPausing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = () => {
    setLoading(true);
    setError(null);
    getAdminQueue(adminKey)
      .then((d) => {
        setData(d);
      })
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Failed to load queue status");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, [adminKey]);

  const handlePause = async () => {
    setPausing(true);
    try {
      await pauseAdminQueue(adminKey);
      toast.success("Queue paused");
      fetch();
    } catch {
      toast.error("Failed to pause");
    } finally {
      setPausing(false);
    }
  };

  const handleResume = async () => {
    setPausing(true);
    try {
      await resumeAdminQueue(adminKey);
      toast.success("Queue resumed");
      fetch();
    } catch {
      toast.error("Failed to resume");
    } finally {
      setPausing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="bg-card rounded-xl border border-border/50 p-6">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{error}</p>
              <p className="text-sm mt-1">Check ADMIN_SECRET_KEY and backend connectivity.</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetch}>Retry</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  const isUnavailable = !data?.counts;
  const isPaused = data?.status === "paused";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="bg-card rounded-xl border border-border/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center">
            <Cpu className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Queue Status</h2>
            <p className="text-sm text-muted-foreground">
              {isUnavailable ? "Redis not connected — running in sync mode" : `Status: ${data?.status || "healthy"}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetch} className="ml-auto">Refresh</Button>
        </div>

        {!isUnavailable && data?.counts && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
              {[
                { label: "Waiting", value: data.counts.waiting, color: "text-muted-foreground" },
                { label: "Active", value: data.counts.active, color: "text-amber-600" },
                { label: "Completed", value: data.counts.completed, color: "text-green-600" },
                { label: "Failed", value: data.counts.failed, color: "text-destructive" },
                { label: "Delayed", value: data.counts.delayed, color: "text-muted-foreground" },
              ].map((c) => (
                <div key={c.label} className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              {isPaused ? (
                <Button onClick={handleResume} disabled={pausing} className="gap-2">
                  {pausing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Resume queue
                </Button>
              ) : (
                <Button variant="outline" onClick={handlePause} disabled={pausing} className="gap-2">
                  {pausing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  Pause queue
                </Button>
              )}
            </div>
          </>
        )}

        {isUnavailable && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">Redis is not connected. Try-ons run synchronously. Configure REDIS_URL in backend .env for queue support.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
