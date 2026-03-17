import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Key, Copy, RefreshCw, Plus, Eye, EyeOff, Check, Shield, Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ApiKey {
  id: string;
  name: string;
  key_value: string;
  created_at: string;
  last_used_at: string | null;
  status: string;
}

export function ApiKeysTab() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load API keys");
      console.error(error);
    } else {
      setKeys(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, [user]);

  const generateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error("Please enter a key name");
      return;
    }
    setGenerating(true);
    const { data, error } = await supabase.rpc("generate_api_key", { p_name: newKeyName.trim() });
    if (error) {
      toast.error("Failed to generate key");
      console.error(error);
    } else {
      toast.success("API key generated successfully");
      setShowNewForm(false);
      setNewKeyName("");
      await fetchKeys();
    }
    setGenerating(false);
  };

  const revokeKey = async (id: string) => {
    const { error } = await supabase
      .from("api_keys")
      .update({ status: "revoked" })
      .eq("id", id);
    if (error) {
      toast.error("Failed to revoke key");
    } else {
      toast.success("API key revoked");
      await fetchKeys();
    }
  };

  const regenerateKey = async (id: string, name: string) => {
    await revokeKey(id);
    const { error } = await supabase.rpc("generate_api_key", { p_name: name });
    if (error) {
      toast.error("Failed to regenerate key");
    } else {
      toast.success("New API key generated");
      await fetchKeys();
    }
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase.from("api_keys").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete key");
    } else {
      toast.success("API key deleted");
      await fetchKeys();
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast.success("API key copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const maskKey = (key: string) => key.slice(0, 12) + "••••••••••••";

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your integration credentials</p>
        </div>
        <div className="flex gap-2">
          <Link to="/api-docs">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" /> API Reference
            </Button>
          </Link>
          <Button onClick={() => setShowNewForm(true)} className="gradient-primary text-primary-foreground shadow-soft gap-2">
            <Plus className="h-4 w-4" /> Generate New Key
          </Button>
        </div>
      </div>

      {/* Security notice */}
      <div className="bg-muted/50 border border-border/50 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Shield className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Keep your API keys secure</p>
          <p className="text-xs text-muted-foreground mt-0.5">Never expose keys in client-side code. Use server-side requests only.</p>
        </div>
      </div>

      {/* New key form */}
      {showNewForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-card rounded-xl border border-border/50 p-5 shadow-card mb-6">
          <p className="text-sm font-semibold text-foreground mb-3">Generate New API Key</p>
          <div className="flex gap-3">
            <Input
              placeholder="Key name (e.g. Production, Staging)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generateKey()}
            />
            <Button onClick={generateKey} disabled={generating} className="gradient-primary text-primary-foreground gap-2 whitespace-nowrap">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Generate
            </Button>
            <Button variant="outline" onClick={() => { setShowNewForm(false); setNewKeyName(""); }}>
              Cancel
            </Button>
          </div>
        </motion.div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <Key className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No API keys yet. Generate your first key to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {keys.map((apiKey) => (
            <div key={apiKey.id} className="bg-card rounded-xl border border-border/50 p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Key className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-display text-sm font-semibold text-foreground">{apiKey.name}</p>
                    <p className="text-xs text-muted-foreground">Created {formatDate(apiKey.created_at)}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                  apiKey.status === "active" ? "bg-foreground/5 text-foreground" : "bg-destructive/10 text-destructive"
                }`}>
                  {apiKey.status}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3">
                <code className="text-sm text-foreground font-mono flex-1">
                  {visibleKeys.has(apiKey.id) ? apiKey.key_value : maskKey(apiKey.key_value)}
                </code>
                <button onClick={() => toggleVisibility(apiKey.id)} className="p-1.5 hover:bg-muted rounded-md transition-colors">
                  {visibleKeys.has(apiKey.id) ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
                <button onClick={() => copyKey(apiKey.key_value, apiKey.id)} className="p-1.5 hover:bg-muted rounded-md transition-colors">
                  {copiedId === apiKey.id ? <Check className="h-4 w-4 text-foreground" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
                {apiKey.status === "active" && (
                  <button onClick={() => regenerateKey(apiKey.id, apiKey.name)} className="p-1.5 hover:bg-muted rounded-md transition-colors" title="Regenerate">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                <button onClick={() => deleteKey(apiKey.id)} className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors" title="Delete">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              {apiKey.last_used_at && (
                <p className="text-xs text-muted-foreground mt-3">Last used: {formatDate(apiKey.last_used_at)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
