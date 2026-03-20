import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, RefreshCw, Filter, Maximize2 } from "lucide-react";
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
import { getAdminAudit } from "@/lib/backendApi";
import { toast } from "sonner";

interface AdminAuditTabProps {
  adminKey: string;
}

interface TargetProfile {
  brand_name: string | null;
  contact_email: string | null;
  full_name: string | null;
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
  target_profile?: TargetProfile | null;
  display_summary?: string | null;
}

const eventSeverityLabel: Record<string, string> = {
  failed_login: "Error",
  api_key_anomaly: "Error",
  rate_limit: "Warning",
  api_key_blocked: "Warning",
  admin_action: "Info",
};

const eventColors: Record<string, string> = {
  admin_action: "border-l-4 border-l-blue-500 bg-blue-500/5",
  failed_login: "border-l-4 border-l-destructive bg-destructive/5",
  rate_limit: "border-l-4 border-l-amber-500 bg-amber-500/5",
  api_key_blocked: "border-l-4 border-l-amber-500 bg-amber-500/5",
  api_key_anomaly: "border-l-4 border-l-destructive bg-destructive/5",
};

const eventBadgeClass: Record<string, string> = {
  admin_action: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  failed_login: "bg-destructive/15 text-destructive",
  rate_limit: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  api_key_blocked: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  api_key_anomaly: "bg-destructive/15 text-destructive",
};

function actionTitle(action: string): string {
  return action.replace(/_/g, " ");
}

function buildFallbackSummary(e: AuditEntry): string {
  const d = e.details || {};
  if (typeof d.summary === "string") return d.summary;
  if (e.target_profile) {
    const p = e.target_profile;
    const label = [p.brand_name, p.contact_email || p.full_name].filter(Boolean).join(" · ");
    if (label) return `${actionTitle(e.action)} → ${label}`;
  }
  if (e.action === "user_banned" || e.action === "user_unbanned") {
    const ban = d.ban_duration ?? d.banDuration;
    const blocked = d.blocked;
    if (e.action === "user_banned" && ban) {
      return `User blocked. Supabase ban duration: ${String(ban)}.${typeof blocked === "boolean" ? ` Profile is_blocked: ${blocked}.` : ""}`;
    }
    if (e.action === "user_unbanned") {
      return `User unblocked.${typeof blocked === "boolean" ? ` blocked flag in payload: ${blocked}.` : ""}`;
    }
  }
  if (e.target_id) return `${actionTitle(e.action)} (target id: ${e.target_id})`;
  return actionTitle(e.action);
}

function formatDetailValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const DETAIL_SUMMARY_KEYS = new Set(["summary"]);

const DETAIL_LABELS: Record<string, string> = {
  target_user_id: "User ID",
  target_brand_name: "Brand",
  target_email: "Email",
  target_full_name: "Full name",
  blocked: "Blocked (API flag)",
  ban_duration: "Auth ban duration",
  banDuration: "Auth ban duration (legacy)",
};

function AuditEntries({ entries, compact = false }: { entries: AuditEntry[]; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2 p-3" : "space-y-3 p-4"}>
      {entries.map((e) => {
        const summary = e.display_summary || buildFallbackSummary(e);
        const details = e.details && typeof e.details === "object" ? e.details : {};
        const detailRows = Object.entries(details).filter(([k]) => !DETAIL_SUMMARY_KEYS.has(k));
        const sev = eventSeverityLabel[e.event_type] || "Event";
        const borderTone = eventColors[e.event_type] || "border-l-4 border-l-border bg-muted/10";

        return (
          <article
            key={e.id}
            className={`rounded-lg border border-border/60 ${borderTone} ${compact ? "p-3" : "p-4"} transition-colors hover:bg-muted/20`}
          >
            <div className="flex flex-wrap items-start gap-2 mb-3">
              <time
                className={`text-muted-foreground tabular-nums shrink-0 ${compact ? "text-[11px]" : "text-xs"}`}
                dateTime={e.created_at}
              >
                {new Date(e.created_at).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "medium",
                })}
              </time>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase tracking-wide ${eventBadgeClass[e.event_type] || "bg-muted"}`}
              >
                {e.event_type.replace(/_/g, " ")}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {sev}
              </Badge>
            </div>

            <h4 className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"} leading-snug`}>
              {actionTitle(e.action)}
            </h4>
            <p className={`text-foreground/90 mt-1 ${compact ? "text-xs" : "text-sm"} leading-relaxed`}>{summary}</p>

            <div className={`flex flex-wrap gap-x-4 gap-y-1 mt-3 text-muted-foreground ${compact ? "text-[11px]" : "text-xs"}`}>
              {e.actor && (
                <span>
                  <span className="font-medium text-foreground/80">Actor:</span> {e.actor}
                </span>
              )}
              {e.ip_address && (
                <span className="font-mono">
                  <span className="font-medium text-foreground/80 font-sans">IP:</span> {e.ip_address}
                </span>
              )}
            </div>

            {e.target_profile &&
              (e.target_profile.brand_name || e.target_profile.contact_email || e.target_profile.full_name) && (
                <p className="text-muted-foreground text-xs mt-2">
                  <span className="font-medium text-foreground/80">Account:</span>{" "}
                  {[e.target_profile.brand_name, e.target_profile.contact_email || e.target_profile.full_name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            {e.target_id && (
               <p className="text-[10px] font-mono text-muted-foreground break-all mt-1">
                 User id: {e.target_id}
               </p>
            )}
            {detailRows.length > 0 && (
              <dl
                className={`grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-border/50 text-muted-foreground ${
                  compact ? "text-[11px]" : "text-xs"
                }`}
              >
                {detailRows.map(([key, value]) => (
                  <div key={key} className="flex gap-2 min-w-0">
                    <dt className="shrink-0 font-medium text-foreground/80 w-36 sm:w-40">
                      {DETAIL_LABELS[key] || key.replace(/_/g, " ")}
                    </dt>
                    <dd className="min-w-0 break-all">{formatDetailValue(key, value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function AdminAuditTab({ adminKey }: AdminAuditTabProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<"" | "error" | "warn" | "info">("");
  const [expanded, setExpanded] = useState(false);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const res = await getAdminAudit(adminKey, 200, 0, {
        eventType: eventFilter || undefined,
        severity: !eventFilter && severityFilter ? severityFilter : undefined,
      });
      setEntries(res.entries || []);
    } catch {
      toast.error("Failed to load audit log");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, [adminKey, eventFilter, severityFilter]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col gap-4 mb-6">
        <p className="text-xs text-muted-foreground max-w-2xl">
          <strong>Severity</strong> groups events (errors, warnings, admin). <strong>Event type</strong> narrows to one
          kind — it overrides severity when set.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Severity</label>
            <Select
              value={severityFilter || "all"}
              onValueChange={(v) => {
                const val = v === "all" ? "" : (v as "error" | "warn" | "info");
                setSeverityFilter(val);
                if (val) setEventFilter("");
              }}
              disabled={!!eventFilter}
            >
              <SelectTrigger className="w-[220px]">
                <Filter className="h-4 w-4 mr-2 shrink-0" />
                <SelectValue placeholder="All severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                <SelectItem value="error">Errors (failed login, key anomaly)</SelectItem>
                <SelectItem value="warn">Warnings (rate limit, key blocked)</SelectItem>
                <SelectItem value="info">Admin actions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Event type</label>
            <Select
              value={eventFilter || "all"}
              onValueChange={(v) => {
                const val = v === "all" ? "" : v;
                setEventFilter(val);
                if (val) setSeverityFilter("");
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All event types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All event types</SelectItem>
                <SelectItem value="admin_action">admin_action</SelectItem>
                <SelectItem value="failed_login">failed_login</SelectItem>
                <SelectItem value="rate_limit">rate_limit</SelectItem>
                <SelectItem value="api_key_blocked">api_key_blocked</SelectItem>
                <SelectItem value="api_key_anomaly">api_key_anomaly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={loadAudit} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="gap-2">
              <Maximize2 className="h-4 w-4" />
              Expand
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Audit log ({entries.length})</span>
        </div>
        <div className="max-h-[min(70vh,720px)] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No audit entries match the current filters.
            </div>
          ) : (
            <AuditEntries entries={entries} compact />
          )}
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle>Audit log — expanded</DialogTitle>
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
