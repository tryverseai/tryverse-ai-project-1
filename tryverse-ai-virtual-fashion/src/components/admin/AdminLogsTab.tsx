import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Loader2, RefreshCw, Filter, Maximize2, ExternalLink, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { clearAdminLogs, getAdminLogs, getAdminSentryConfig } from "@/lib/backendApi";
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

function levelBadgeVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  const l = level.toLowerCase();
  if (l === "error") return "destructive";
  if (l === "warn" || l === "warning") return "outline";
  if (l === "debug") return "secondary";
  return "secondary";
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

function LogEntries({ logs, compact = false }: { logs: LogEntry[]; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2 p-3" : "space-y-3 p-4"}>
      {logs.map((entry, i) => {
        const metaStr = formatMeta(entry.meta);
        const isHttpLine = /^\S+ - - \[\d{2}\//.test(entry.message.trim());
        return (
          <div
            key={`${entry.timestamp}-${i}`}
            className={`rounded-lg border border-border/70 bg-muted/15 hover:bg-muted/25 transition-colors ${
              compact ? "p-3" : "p-4"
            } ${isHttpLine ? "opacity-95" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2 gap-y-2 mb-2">
              <time
                className={`text-muted-foreground tabular-nums shrink-0 ${
                  compact ? "text-[11px]" : "text-xs"
                }`}
                dateTime={entry.timestamp}
              >
                {new Date(entry.timestamp).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "medium",
                })}
              </time>
              <Badge variant={levelBadgeVariant(entry.level)} className="uppercase text-[10px] tracking-wide">
                {entry.level}
              </Badge>
              {isHttpLine && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">HTTP</span>
              )}
            </div>
            <p
              className={`font-mono text-foreground break-words whitespace-pre-wrap leading-relaxed ${
                compact ? "text-[11px]" : "text-xs"
              }`}
            >
              {entry.message}
            </p>
            {metaStr ? (
              <pre
                className={`mt-3 rounded-md bg-background/80 border border-border/50 overflow-x-auto text-muted-foreground ${
                  compact ? "text-[10px] p-2 max-h-40" : "text-xs p-3 max-h-56"
                }`}
              >
                {metaStr}
              </pre>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AdminLogsTab({ adminKey }: AdminLogsTabProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sentryConfig, setSentryConfig] = useState<{ enabled: boolean; issuesUrl?: string } | null>(null);
  const [hideHttp, setHideHttp] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
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
    fetchLogs();
  }, [adminKey, levelFilter]);

  useEffect(() => {
    getAdminSentryConfig(adminKey)
      .then(setSentryConfig)
      .catch(() => setSentryConfig({ enabled: false }));
  }, [adminKey]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      getAdminLogs(adminKey, 300, levelFilter || undefined)
        .then((res) => setLogs(res.logs || []))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, adminKey, levelFilter]);

  const displayLogs = useMemo(() => {
    if (!hideHttp) return logs;
    return logs.filter((e) => !/^\S+ - - \[\d{2}\//.test(String(e.message || "").trim()));
  }, [logs, hideHttp]);

  const handleClearLogs = async () => {
    if (
      !confirm(
        "Clear the in-memory log buffer? New requests will still be logged. This cannot be undone for the current buffer."
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await clearAdminLogs(adminKey);
      setLogs([]);
      toast.success("Log buffer cleared");
    } catch {
      toast.error("Failed to clear logs");
    } finally {
      setClearing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Log level</label>
            <Select value={levelFilter || "all"} onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="verbose">Verbose</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer sm:pb-2">
            <input
              type="checkbox"
              className="rounded border-input"
              checked={hideHttp}
              onChange={(e) => setHideHttp(e.target.checked)}
            />
            Hide HTTP access lines
          </label>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2"
            >
              {autoRefresh ? "Auto (5s) on" : "Auto off"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="gap-2">
              <Maximize2 className="h-4 w-4" />
              Expand
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearLogs}
              disabled={clearing || loading}
              className="gap-2"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clear logs
            </Button>
          </div>
        </div>
      </div>

      {sentryConfig?.enabled && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Info className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-sm font-semibold text-foreground">Sentry monitoring</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Backend errors are sent to Sentry. Open your Sentry project to see issues and stack traces.
              </p>
            </div>
            {sentryConfig.issuesUrl ? (
              <a
                href={sentryConfig.issuesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
                Open issues
              </a>
            ) : (
              <div className="text-xs text-muted-foreground shrink-0 max-w-xs text-right space-y-1">
                <p>
                  Optional shortcut: add{" "}
                  <code className="px-1 py-0.5 rounded bg-muted text-[10px]">SENTRY_ISSUES_URL</code> to{" "}
                  <code className="px-1 py-0.5 rounded bg-muted text-[10px]">backend/.env</code>, restart the API.
                </p>
                <p className="text-[10px] opacity-90">
                  In Sentry, open <strong>Issues</strong>, then copy the URL from the address bar (must be the web UI, not
                  the DSN ingest host).
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Recent logs ({displayLogs.length}
              {hideHttp && logs.length !== displayLogs.length ? ` / ${logs.length} total` : ""})
            </span>
          </div>
        </div>
        <div className="max-h-[min(70vh,720px)] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No logs match the current filters.</div>
          ) : (
            <LogEntries logs={displayLogs} compact />
          )}
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle>Logs — expanded</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {displayLogs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No logs to display.</div>
            ) : (
              <LogEntries logs={displayLogs} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
