import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, RefreshCw, Filter, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAdminAudit } from "@/lib/backendApi";
import { toast } from "sonner";

interface AdminAuditTabProps {
  adminKey: string;
}

interface AuditEntry {
  id: string;
  event_type: string;
  actor: string | null;
  action: string;
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

const eventColors: Record<string, string> = {
  admin_action: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  failed_login: "bg-destructive/20 text-destructive",
  rate_limit: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  api_key_blocked: "bg-amber-500/20 text-amber-600",
  api_key_anomaly: "bg-destructive/20 text-destructive",
};

function AuditEntries({ entries, compact = false }: { entries: AuditEntry[]; compact?: boolean }) {
  return (
    <div className={`divide-y divide-border/50 ${compact ? "text-xs" : "text-sm"}`}>
      {entries.map((e) => (
        <div
          key={e.id}
          className={`hover:bg-muted/30 flex flex-wrap gap-x-4 gap-y-1 items-start ${compact ? "px-5 py-2" : "px-4 py-3"}`}
        >
          <span className="text-muted-foreground shrink-0">
            {new Date(e.created_at).toLocaleString()}
          </span>
          <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${eventColors[e.event_type] || "bg-muted text-muted-foreground"}`}>
            {e.event_type}
          </span>
          <span className="font-medium">{e.action}</span>
          {e.actor && <span className="text-muted-foreground">by {e.actor}</span>}
          {e.target_id && <span className="text-muted-foreground">→ {e.target_id}</span>}
          {e.ip_address && <span className="text-muted-foreground">IP: {e.ip_address}</span>}
          {e.details && Object.keys(e.details).length > 0 && (
            <span className="text-muted-foreground ml-auto">{JSON.stringify(e.details)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminAuditTab({ adminKey }: AdminAuditTabProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [expanded, setExpanded] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getAdminAudit(adminKey, 200, 0, eventFilter || undefined);
      setEntries(res.entries || []);
    } catch (err) {
      toast.error("Failed to load audit log");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [adminKey, eventFilter]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select value={eventFilter || "all"} onValueChange={(v) => setEventFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="admin_action">Admin actions</SelectItem>
            <SelectItem value="failed_login">Failed logins</SelectItem>
            <SelectItem value="rate_limit">Rate limits</SelectItem>
            <SelectItem value="api_key_blocked">API key blocked</SelectItem>
            <SelectItem value="api_key_anomaly">API key anomaly</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="gap-2 ml-auto">
          <Maximize2 className="h-4 w-4" />
          Expand
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Audit log ({entries.length})</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No audit entries yet. Admin actions, failed logins, and rate limits will appear here.
            </div>
          ) : (
            <AuditEntries entries={entries} compact />
          )}
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle>Audit log — Expanded view</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {entries.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No audit entries to display.</div>
            ) : (
              <AuditEntries entries={entries} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
