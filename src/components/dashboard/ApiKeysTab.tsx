import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Copy, Check, Terminal, PlugZap, Plus, Ban, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  listApiKeys,
  createNamedApiKey,
  revokeApiKeyById,
  type ApiKeyRecord,
  type ApiKeyScope,
} from "@/lib/backendApi";

function ScopeBadges({ scopes }: { scopes?: ApiKeyScope[] | null }) {
  if (!scopes || scopes.length === 0) {
    return <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Full access</span>;
  }
  return (
    <span className="flex gap-1">
      {scopes.map((s) => (
        <span
          key={s}
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
            s === "write" ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {s}
        </span>
      ))}
    </span>
  );
}

function ExpiryLabel({ expiresAt, expired }: { expiresAt?: string | null; expired?: boolean }) {
  if (!expiresAt) return <span className="text-muted-foreground">Never expires</span>;
  const date = new Date(expiresAt);
  const formatted = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  if (expired) return <span className="text-destructive">Expired {formatted}</span>;
  return <span className="text-muted-foreground">Expires {formatted}</span>;
}

function KeyRow({ record, onRevoked }: { record: ApiKeyRecord; onRevoked: (id: string) => void }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const masked = `${record.key_value.slice(0, 11)}${"•".repeat(24)}${record.key_value.slice(-4)}`;

  const copy = () => {
    navigator.clipboard.writeText(record.key_value);
    setCopied(true);
    toast.success("API key copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!window.confirm(`Revoke "${record.name}"? Any integration using this key will stop working immediately.`)) return;
    setRevoking(true);
    try {
      await revokeApiKeyById(record.id);
      toast.success(`"${record.name}" revoked`);
      onRevoked(record.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not revoke this key");
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-medium text-foreground">{record.name}</span>
          <ScopeBadges scopes={record.scopes} />
          <span className="text-xs">
            <ExpiryLabel expiresAt={record.expires_at} expired={record.expired} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setRevealed((r) => !r)} className="gap-1.5 text-xs h-7">
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5 text-xs h-7">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleRevoke()}
            disabled={revoking}
            className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive"
          >
            <Ban className="h-3.5 w-3.5" />
            {revoking ? "Revoking…" : "Revoke"}
          </Button>
        </div>
      </div>
      <p className="px-4 py-3 text-sm font-mono text-foreground break-all">{revealed ? record.key_value : masked}</p>
    </div>
  );
}

function CreateKeyDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (key: ApiKeyRecord) => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiKeyScope[]>(["read", "write"]);
  const [expiry, setExpiry] = useState<"never" | "30" | "90" | "365">("never");
  const [creating, setCreating] = useState(false);

  const toggleScope = (scope: ApiKeyScope) => {
    setScopes((prev) => {
      const next = prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope];
      return next;
    });
  };

  const handleCreate = async () => {
    if (scopes.length === 0) {
      toast.error("Select at least one scope");
      return;
    }
    setCreating(true);
    try {
      const key = await createNamedApiKey({
        name: name.trim() || "Untitled key",
        scopes,
        expiresInDays: expiry === "never" ? undefined : Number(expiry),
      });
      toast.success(`"${key.name}" created`);
      onCreated(key);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create key");
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-xl border border-border/50 shadow-card w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold text-foreground">Create API key</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Reporting integration"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-4"
          autoFocus
        />

        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Access</label>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => toggleScope("read")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition ${
              scopes.includes("read") ? "border-foreground bg-foreground/5" : "border-border"
            }`}
          >
            <span className="font-medium text-foreground">Read</span>
            <p className="text-xs text-muted-foreground mt-0.5">Check status, list domains</p>
          </button>
          <button
            type="button"
            onClick={() => toggleScope("write")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition ${
              scopes.includes("write") ? "border-foreground bg-foreground/5" : "border-border"
            }`}
          >
            <span className="font-medium text-foreground">Write</span>
            <p className="text-xs text-muted-foreground mt-0.5">Upload images, run try-ons</p>
          </button>
        </div>

        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Expiration</label>
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value as typeof expiry)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-6"
        >
          <option value="never">Never expires</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </select>

        <Button onClick={() => void handleCreate()} disabled={creating} className="w-full">
          {creating ? "Creating…" : "Create key"}
        </Button>
      </motion.div>
    </motion.div>
  );
}

export function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    listApiKeys()
      .then(setKeys)
      .catch(() => toast.error("Could not load your API keys"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">Integration credentials for your storefront</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New key
          </Button>
          <Link to="/dashboard/business?tab=Developers">
            <Button variant="outline" className="gap-2">
              <Terminal className="h-4 w-4" /> Developer docs
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="h-16 rounded-xl bg-muted/20 animate-pulse" />
        ) : keys && keys.length > 0 ? (
          keys.map((k) => (
            <KeyRow key={k.id} record={k} onRevoked={(id) => setKeys((prev) => prev?.filter((k2) => k2.id !== id) ?? null)} />
          ))
        ) : (
          <div className="bg-card rounded-xl border border-border/50 shadow-card text-center py-10">
            <Key className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No API keys yet.</p>
            <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Create your first key
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4 inline-flex items-center gap-1.5">
        <PlugZap className="h-3 w-3" />
        <Link to="/dashboard/business?tab=Connect%20Store" className="hover:text-foreground transition-colors">
          Go to Connect Store
        </Link>
        {" "}for the simple, single automatic key used during onboarding.
      </p>

      <AnimatePresence>
        {showCreate && (
          <CreateKeyDialog
            onClose={() => setShowCreate(false)}
            onCreated={(key) => setKeys((prev) => [key, ...(prev ?? [])])}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
