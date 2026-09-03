import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Ban, Unlock, Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getAdminUsers, banAdminUser, adjustUserCredits, deleteAdminUserAccount } from "@/lib/backendApi";
import { toast } from "sonner";

interface AdminUsersTabProps {
  adminKey: string;
}

interface AdminUser {
  id: string;
  brand_name: string;
  full_name: string;
  contact_email: string | null;
  plan_id?: string;
  current_plan_id?: string;
  free_credits_remaining: number;
  monthly_credits_remaining: number;
  monthly_credits_total: number;
  widget_activated: boolean;
  created_at: string;
  is_banned?: boolean;
  banned_until?: string | null;
  account_type?: string;
}

export function AdminUsersTab({ adminKey }: AdminUsersTabProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<"all" | "business">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditsDialog, setCreditsDialog] = useState<AdminUser | null>(null);
  const [freeCredits, setFreeCredits] = useState(0);
  const [monthlyCredits, setMonthlyCredits] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleDeleteAccount = async (u: AdminUser) => {
    const label = u.contact_email || u.brand_name || "this user";
    if (
      !confirm(
        `Permanently delete ${label}? This removes their profile, API keys, try-ons, and related data. This cannot be undone.`
      )
    )
      return;
    try {
      await deleteAdminUserAccount(adminKey, u.id);
      toast.success("Account deleted");
      await fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminUsers(
        adminKey,
        pagination.page,
        pagination.limit,
        search || undefined,
        accountFilter
      );
      setUsers((res.users || []) as unknown as AdminUser[]);
      setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [adminKey, pagination.page, search, accountFilter]);

  const handleBlock = async (u: AdminUser) => {
    if (!confirm(`Block ${u.brand_name || u.contact_email || "this user"}? They will not be able to use the API.`)) return;
    try {
      await banAdminUser(adminKey, u.id, false);
      toast.success("User blocked");
      await fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to block user");
    }
  };

  const handleUnblock = async (u: AdminUser) => {
    if (!confirm(`Unblock ${u.brand_name || u.contact_email || "this user"}?`)) return;
    try {
      await banAdminUser(adminKey, u.id, true);
      toast.success("User unblocked");
      await fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to unblock user");
    }
  };

  const openCreditsDialog = (u: AdminUser) => {
    setCreditsDialog(u);
    setFreeCredits(u.free_credits_remaining);
    setMonthlyCredits(u.monthly_credits_remaining);
  };

  const handleSaveCredits = async () => {
    if (!creditsDialog) return;
    setSaving(true);
    try {
      await adjustUserCredits(adminKey, creditsDialog.id, {
        freeCredits: freeCredits,
        monthlyCredits: monthlyCredits,
      });
      toast.success("Credits updated");
      setCreditsDialog(null);
      fetchUsers();
    } catch {
      toast.error("Failed to update credits");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: "All accounts" },
              { id: "business" as const, label: "Business" },
            ]
          ).map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={accountFilter === t.id ? "default" : "outline"}
              onClick={() => {
                setAccountFilter(t.id);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by brand or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={fetchUsers}>
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive flex items-center justify-between">
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchUsers}>Retry</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Brand / name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Type</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Plan</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Credits</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Widget</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Joined</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-foreground">{u.brand_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.contact_email || u.full_name || u.id.slice(0, 8)}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm">Business</td>
                    <td className="px-5 py-4 text-sm capitalize">{u.plan_id || u.current_plan_id || "free"}</td>
                    <td className="px-5 py-4 text-sm">
                      {u.free_credits_remaining + (u.monthly_credits_remaining || 0)} total
                    </td>
                    <td className="px-5 py-4">
                      {u.widget_activated ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-600 dark:text-green-400">On</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Off</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {u.is_banned ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-destructive/15 text-destructive font-medium">Blocked</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Active</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openCreditsDialog(u)} className="h-8 gap-1">
                          <Plus className="h-3.5 w-3.5" /> Credits
                        </Button>
                        {u.is_banned ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnblock(u)}
                            className="h-8 gap-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                            title="Unblock user"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Unblock</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleBlock(u)}
                            className="h-8 gap-1 text-destructive hover:text-destructive"
                            title="Block user"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Block</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteAccount(u)}
                          className="h-8 gap-1 text-muted-foreground hover:text-destructive"
                          title="Permanently delete account"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.pages > 1 && (
            <div className="flex justify-between px-5 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">{pagination.total} users</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}>Prev</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!creditsDialog} onOpenChange={() => setCreditsDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add or remove credits for {creditsDialog?.brand_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Free credits</label>
              <Input type="number" min={0} value={freeCredits} onChange={(e) => setFreeCredits(parseInt(e.target.value) || 0)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Monthly credits remaining</label>
              <Input type="number" min={0} value={monthlyCredits} onChange={(e) => setMonthlyCredits(parseInt(e.target.value) || 0)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditsDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveCredits} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
