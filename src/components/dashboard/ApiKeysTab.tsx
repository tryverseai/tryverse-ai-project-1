import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Key, Copy, Check, RefreshCw, Terminal, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getOrCreateApiKey, regenerateApiKey, type ApiKeyRecord } from "@/lib/backendApi";

export function ApiKeysTab() {
  const [key, setKey] = useState<ApiKeyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOrCreateApiKey()
      .then((k) => { if (!cancelled) setKey(k); })
      .catch(() => { if (!cancelled) toast.error("Could not load your API key"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const copy = () => {
    if (!key) return;
    navigator.clipboard.writeText(key.key_value);
    setCopied(true);
    toast.success("API key copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const k = await regenerateApiKey();
      setKey(k);
      toast.success("New key generated — the old one no longer works");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not regenerate the key");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">Integration credentials for your storefront</p>
        </div>
        <Link to="/dashboard/business?tab=Developers">
          <Button variant="outline" className="gap-2">
            <Terminal className="h-4 w-4" /> Developer docs
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-card p-6">
        {loading ? (
          <div className="h-16 rounded-xl bg-muted/20 animate-pulse" />
        ) : key ? (
          <>
            <div className="rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                <span className="text-xs font-medium text-muted-foreground">{key.name}</span>
                <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5 text-xs h-7">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="px-4 py-3 text-sm font-mono text-foreground break-all">{key.key_value}</p>
            </div>
            <div className="flex items-center justify-between mt-3">
              <button
                type="button"
                onClick={() => void handleRegenerate()}
                disabled={regenerating}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${regenerating ? "animate-spin" : ""}`} />
                {regenerating ? "Regenerating…" : "Regenerate key"}
              </button>
              <Link to="/dashboard/business?tab=Connect%20Store" className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                <PlugZap className="h-3 w-3" /> Go to Connect Store
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-10">
            <Key className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Could not load your key. Refresh to try again.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
