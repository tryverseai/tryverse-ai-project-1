import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ApiError,
  adminCreateInvite,
  adminDeleteInvite,
  adminSendInvite,
  getAdminInvites,
  getAdminWaitlistEarlyAccess,
  patchAdminWaitlistReview,
  type AdminLifecycleInvite,
  type AdminWaitlistRow,
} from "@/lib/backendApi";

interface AdminInvitesTabProps {
  adminKey: string;
}

function formatWhen(isoOrMs: string | number | undefined | null): string {
  if (isoOrMs == null) return "—";
  if (typeof isoOrMs === "number") {
    if (!Number.isFinite(isoOrMs)) return "—";
    return new Date(isoOrMs).toLocaleString();
  }
  const d = new Date(isoOrMs);
  return Number.isNaN(d.getTime()) ? String(isoOrMs) : d.toLocaleString();
}

function truncateToken(t: string): string {
  if (t.length <= 16) return t;
  return `${t.slice(0, 14)}…`;
}

function waitlistAccountLabel(row: AdminWaitlistRow): "Personal" | "Business" {
  const raw = String(row.applicant_type ?? "").toLowerCase();
  if (raw === "individual" || raw === "personal") return "Personal";
  return "Business";
}

function inviteStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === "pending") {
    return (
      <Badge className="border-amber-400/40 bg-amber-500/15 text-amber-800 dark:text-amber-200" variant="outline">
        pending
      </Badge>
    );
  }
  if (s === "sent") {
    return (
      <Badge className="border-sky-400/40 bg-sky-500/15 text-sky-800 dark:text-sky-200" variant="outline">
        sent
      </Badge>
    );
  }
  if (s === "accepted") {
    return (
      <Badge className="border-emerald-400/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" variant="outline">
        accepted
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {status}
    </Badge>
  );
}

function accountTypeBadge(kind: "personal" | "business" | "Individual" | "Business") {
  const isPersonal =
    kind === "personal" ||
    kind === "Individual" ||
    String(kind).toLowerCase() === "personal";
  if (isPersonal) {
    return (
      <Badge className="border-violet-400/40 bg-violet-600/15 text-violet-800 dark:text-violet-200" variant="outline">
        Personal
      </Badge>
    );
  }
  return (
    <Badge className="border-blue-400/40 bg-blue-600/15 text-blue-800 dark:text-blue-200" variant="outline">
      Business
    </Badge>
  );
}

export function AdminInvitesTab({ adminKey }: AdminInvitesTabProps) {
  const [waitlist, setWaitlist] = useState<AdminWaitlistRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<AdminLifecycleInvite[]>([]);
  const [allInvites, setAllInvites] = useState<AdminLifecycleInvite[]>([]);
  const [allFilter, setAllFilter] = useState<"all" | "personal" | "business">("all");
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, string>>({});

  const setBusy = (id: string, op: string | null) => {
    setRowBusy((prev) => {
      const next = { ...prev };
      if (op == null) delete next[id];
      else next[id] = op;
      return next;
    });
  };

  const loadWaitlist = useCallback(async () => {
    setLoadingWaitlist(true);
    try {
      const { rows } = await getAdminWaitlistEarlyAccess(adminKey);
      const open = (rows || []).filter((r) => {
        const st = String(r.waitlist_review_status ?? "").toLowerCase();
        return st !== "ignored";
      });
      setWaitlist(open);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load waitlist");
    } finally {
      setLoadingWaitlist(false);
    }
  }, [adminKey]);

  const loadPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const { invites } = await getAdminInvites(adminKey, { status: "pending" });
      const rows = [...(invites || [])].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setPendingInvites(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load pending invites");
    } finally {
      setLoadingPending(false);
    }
  }, [adminKey]);

  const loadAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const opts =
        allFilter === "all" ? undefined : { accountType: allFilter as "personal" | "business" };
      const { invites } = await getAdminInvites(adminKey, opts);
      const rows = [...(invites || [])].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setAllInvites(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load invites");
    } finally {
      setLoadingAll(false);
    }
  }, [adminKey, allFilter]);

  useEffect(() => {
    void loadWaitlist();
    void loadPending();
  }, [loadWaitlist, loadPending]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateInvite = async (row: AdminWaitlistRow) => {
    const id = `wl-${row.id}`;
    setBusy(id, "create");
    try {
      const kind = waitlistAccountLabel(row);
      if (kind === "Business" && !row.brand_name?.trim()) {
        toast.error("Add a company name to this application before creating a business invite.");
        return;
      }
      await adminCreateInvite(adminKey, {
        email: row.email,
        name: row.first_name?.trim() || undefined,
        accountType: kind === "Personal" ? "personal" : "business",
        companyName: kind === "Business" ? row.brand_name?.trim() : undefined,
      });
      toast.success("Invite created — review in Pending tab");
      await loadPending();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(id, null);
    }
  };

  const handleIgnore = async (row: AdminWaitlistRow) => {
    const id = `wl-${row.id}`;
    setBusy(id, "ignore");
    try {
      await patchAdminWaitlistReview(adminKey, row.id, "ignored");
      toast.success("Marked as reviewed");
      await loadWaitlist();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(id, null);
    }
  };

  const handleSend = async (inv: AdminLifecycleInvite) => {
    setBusy(inv.token, "send");
    try {
      await adminSendInvite(adminKey, inv.token);
      toast.success(`Invite sent to ${inv.email}`);
      await loadPending();
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(inv.token, null);
    }
  };

  const handleDeleteInvite = async (token: string) => {
    if (!confirm("Delete this invite? This cannot be undone.")) return;
    setBusy(token, "delete");
    try {
      await adminDeleteInvite(adminKey, token);
      toast.success("Invite deleted");
      await loadPending();
      await loadAll();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(token, null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Invite Management</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Review waitlist applications, create invites, then send email manually when ready. Links only work after send.
          </p>
        </div>
      </div>

      <Tabs defaultValue="waitlist" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="waitlist" className="text-xs sm:text-sm">
            Waitlist
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs sm:text-sm">
            Pending Invites
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            All Invites
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waitlist" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void loadWaitlist()}
              disabled={loadingWaitlist}
            >
              {loadingWaitlist ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
          <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Account type</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Date applied</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingWaitlist && waitlist.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2 align-middle" />
                      Loading waitlist…
                    </TableCell>
                  </TableRow>
                ) : waitlist.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No open waitlist entries.
                    </TableCell>
                  </TableRow>
                ) : (
                  waitlist.map((row) => {
                    const wl = waitlistAccountLabel(row);
                    const busy = rowBusy[`wl-${row.id}`];
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.first_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{row.email}</TableCell>
                        <TableCell>{accountTypeBadge(wl === "Personal" ? "personal" : "business")}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {wl === "Business" && row.brand_name?.trim() ? row.brand_name : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatWhen(row.created_at)}</TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!!busy}
                            onClick={() => void handleCreateInvite(row)}
                          >
                            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Invite"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!!busy}
                            className="text-muted-foreground"
                            onClick={() => void handleIgnore(row)}
                          >
                            {busy === "ignore" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ignore"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void loadPending()}
              disabled={loadingPending}
            >
              {loadingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
          <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Account type</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPending && pendingInvites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2 align-middle" />
                      Loading invites…
                    </TableCell>
                  </TableRow>
                ) : pendingInvites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No pending invites.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingInvites.map((inv) => {
                    const busy = rowBusy[inv.token];
                    const kind = inv.accountType === "personal" ? ("personal" as const) : ("business" as const);
                    return (
                      <TableRow key={inv.token}>
                        <TableCell className="font-medium">{inv.name?.trim() || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{inv.email}</TableCell>
                        <TableCell>{accountTypeBadge(kind)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {kind === "business" && inv.companyName?.trim() ? inv.companyName : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{truncateToken(inv.token)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatWhen(inv.createdAt)}</TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button
                            size="sm"
                            className="gradient-primary text-primary-foreground"
                            disabled={!!busy}
                            onClick={() => void handleSend(inv)}
                          >
                            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!!busy}
                            onClick={() => void handleDeleteInvite(inv.token)}
                          >
                            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select value={allFilter} onValueChange={(v) => setAllFilter(v as typeof allFilter)}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 self-end sm:self-auto"
              onClick={() => void loadAll()}
              disabled={loadingAll}
            >
              {loadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
          <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Account type</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAll && allInvites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2 align-middle" />
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : allInvites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                      No invites match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  allInvites.map((inv) => {
                    const busy = rowBusy[inv.token];
                    const kind = inv.accountType === "personal" ? ("personal" as const) : ("business" as const);
                    return (
                      <TableRow key={inv.token}>
                        <TableCell>{inviteStatusBadge(inv.status)}</TableCell>
                        <TableCell className="font-medium">{inv.name?.trim() || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{inv.email}</TableCell>
                        <TableCell>{accountTypeBadge(kind)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {kind === "business" && inv.companyName?.trim() ? inv.companyName : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{truncateToken(inv.token)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatWhen(inv.createdAt)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatWhen(inv.sentAt ?? null)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatWhen(inv.acceptedAt ?? null)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!!busy}
                            onClick={() => void handleDeleteInvite(inv.token)}
                          >
                            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
