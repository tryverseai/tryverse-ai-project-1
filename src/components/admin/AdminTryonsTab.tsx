import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminTryons, retryTryOn } from "@/lib/backendApi";
import { toast } from "sonner";

interface AdminTryonsTabProps {
  adminKey: string;
}

interface TryonRow {
  id: string;
  user_id: string | null;
  brand_name?: string | null;
  contact_email?: string | null;
  status: string;
  category: string;
  created_at: string;
  completed_at: string | null;
}

export function AdminTryonsTab({ adminKey }: AdminTryonsTabProps) {
  const [tryons, setTryons] = useState<TryonRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getAdminTryons(adminKey, pagination.page, pagination.limit, statusFilter || undefined);
      setTryons((res.tryons || []) as unknown as TryonRow[]);
      setPagination((p) => ({ ...p, ...res.pagination }));
    } catch {
      toast.error("Failed to fetch try-ons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [adminKey, pagination.page, statusFilter]);

  const handleRetry = async (t: TryonRow) => {
    if (t.status !== "failed") return;
    setRetrying(t.id);
    try {
      await retryTryOn(adminKey, t.id);
      toast.success("Job re-queued");
      fetch();
    } catch {
      toast.error("Failed to retry");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetch}>Refresh</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">ID</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">User</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Category</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Created</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tryons.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-4 font-mono text-xs text-foreground" title={t.id}>{t.id.slice(0, 8)}…</td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-foreground text-sm">{t.brand_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{t.contact_email || (t.user_id ? `User ${t.user_id.slice(0, 8)}…` : "—")}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        t.status === "completed" ? "bg-green-500/20 text-green-600" :
                        t.status === "failed" ? "bg-destructive/20 text-destructive" :
                        t.status === "processing" ? "bg-amber-500/20 text-amber-600" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm capitalize">{t.category}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {t.status === "failed" && (
                        <Button variant="ghost" size="sm" onClick={() => handleRetry(t)} disabled={!!retrying} className="gap-1">
                          {retrying === t.id ? <Loader2 className="h-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Retry
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && (
            <div className="flex justify-between px-5 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">{pagination.total} try-ons</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>Prev</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
