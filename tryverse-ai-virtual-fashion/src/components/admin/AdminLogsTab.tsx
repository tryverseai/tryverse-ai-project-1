import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Loader2, RefreshCw, Filter, Maximize2 } from "lucide-react";
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
import { getAdminLogs } from "@/lib/backendApi";
import { toast } from "sonner";

interface AdminLogsTabProps {
  adminKey: string;
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const levelColors: Record<string, string> = {
  error: "text-destructive",
  warn: "text-amber-600 dark:text-amber-400",
  info: "text-foreground",
  debug: "text-muted-foreground",
};

function LogEntries({ logs, compact = false }: { logs: LogEntry[]; compact?: boolean }) {
  return (
    <div className={`divide-y divide-border/50 font-mono ${compact ? "text-xs" : "text-sm"}`}>
      {logs.map((entry, i) => (
        <div
          key={`${entry.timestamp}-${i}`}
          className={`hover:bg-muted/30 flex gap-3 items-start ${compact ? "px-5 py-2" : "px-4 py-3"}`}
        >
          <span className="text-muted-foreground shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
          <span className={`shrink-0 font-semibold ${levelColors[entry.level] || "text-foreground"}`}>
            [{entry.level}]
          </span>
          <span className="text-foreground break-all flex-1">{entry.message}</span>
          {entry.meta && Object.keys(entry.meta).length > 0 && (
            <span className="text-muted-foreground shrink-0"> {JSON.stringify(entry.meta)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminLogsTab({ adminKey }: AdminLogsTabProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await getAdminLogs(adminKey, 300, levelFilter || undefined);
      setLogs(res.logs || []);
    } catch {
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [adminKey, levelFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      getAdminLogs(adminKey, 300, levelFilter || undefined)
        .then((res) => setLogs(res.logs || []))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, adminKey, levelFilter]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select value={levelFilter || "all"} onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="debug">Debug</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
        <Button
          variant={autoRefresh ? "default" : "outline"}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="gap-2"
        >
          {autoRefresh ? "Auto-refresh ON (5s)" : "Auto-refresh OFF"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="gap-2 ml-auto">
          <Maximize2 className="h-4 w-4" />
          Expand
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Recent logs ({logs.length})</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No logs yet. Activity will appear here.</div>
          ) : (
            <LogEntries logs={logs} compact />
          )}
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle>Logs — Expanded view</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {logs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No logs to display.</div>
            ) : (
              <LogEntries logs={logs} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
