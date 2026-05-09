import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approveAdminBetaAccess,
  getAdminBetaPending,
  rejectAdminBetaAccess,
  type AdminPendingBetaRow,
} from "@/lib/backendApi";

interface AdminBetaAccessTabProps {
  adminKey: string;
}

function accountLabel(at: string): string {
  return at.toLowerCase() === "individual" ? "Individual" : "Business";
}

function formatSignupDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function AdminBetaAccessTab({ adminKey }: AdminBetaAccessTabProps) {
  const [rows, setRows] = useState<AdminPendingBetaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { profiles } = await getAdminBetaPending(adminKey);
      setRows(profiles ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load pending beta users");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const doApprove = async (userId: string) => {
    setBusyId(userId);
    try {
      await approveAdminBetaAccess(adminKey, userId);
      toast.success("Beta access approved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const doReject = async (userId: string) => {
    const ok = confirm(
      "Reject this signup? They'll see that access was not approved until you change Convex data manually."
    );
    if (!ok) return;
    setBusyId(userId);
    try {
      await rejectAdminBetaAccess(adminKey, userId);
      toast.success("Signup rejected");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-7 w-7" />
            Beta access
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Approve or reject <strong>self-serve signups</strong> who are waiting for closed-beta access (
            <code className="text-xs rounded bg-muted px-1">beta_approved</code> not true).
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Name</TableHead>
              <TableHead className="min-w-[180px]">Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Signup</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin inline mr-2" />
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                  No pending beta signups.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const name =
                  String(r.full_name ?? "").trim() ||
                  String(r.brand_name ?? "").trim() ||
                  "—";
                const email = String(r.contact_email ?? "").trim() || "—";
                return (
                  <TableRow key={r.userId}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{accountLabel(r.account_type)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatSignupDate(r.created_at)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        type="button"
                        size="sm"
                        className="mr-2 gradient-primary text-primary-foreground shadow-soft"
                        disabled={busyId !== null}
                        onClick={() => void doApprove(r.userId)}
                      >
                        {busyId === r.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve access"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => void doReject(r.userId)}
                      >
                        <UserX className="h-4 w-4 mr-1 inline" aria-hidden />
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}
