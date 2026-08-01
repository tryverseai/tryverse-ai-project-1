import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Key, Loader2, Trash2, Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminApiKeys, revokeAdminApiKey, getAdminDomains } from "@/lib/backendApi";
import { toast } from "sonner";

interface AdminApiKeysTabProps {
  adminKey: string;
}

export function AdminApiKeysTab({ adminKey }: AdminApiKeysTabProps) {
  const [keys, setKeys] = useState<Array<{
    id: string;
    user_id: string;
    key_value: string;
    key_preview: string;
    name: string;
    status: string;
    last_used: string | null;
    created_at: string;
    brand_name: string;
  }>>([]);
  const [domains, setDomains] = useState<Array<{
    id: string;
    api_key_id: string;
    domain: string;
    verified: boolean;
    created_at: string;
    brand_name: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"keys" | "domains">("keys");

  const fetch = async () => {
    setLoading(true);
    try {
      const [k, d] = await Promise.all([
        getAdminApiKeys(adminKey),
        getAdminDomains(adminKey).catch(() => ({ domains: [] })),
      ]);
      setKeys((k.keys || []) as typeof keys);
      setDomains(d.domains || []);
    } catch {
      toast.error("Failed to load API data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [adminKey]);

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this API key? It will stop working immediately.")) return;
    setRevoking(keyId);
    try {
      await revokeAdminApiKey(adminKey, keyId);
      toast.success("Key revoked");
      fetch();
    } catch {
      toast.error("Failed to revoke");
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeSection === "keys" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSection("keys")}
          className="gap-2"
        >
          <Key className="h-4 w-4" />
          API keys
        </Button>
        <Button
          variant={activeSection === "domains" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSection("domains")}
          className="gap-2"
        >
          <Globe className="h-4 w-4" />
          Allowed domains
        </Button>
        <Button variant="ghost" size="sm" onClick={fetch} className="ml-auto gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {activeSection === "keys" && (
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Brand</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Key</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Last used</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-4 font-medium text-sm">{k.brand_name}</td>
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{k.key_preview}</td>
                    <td className="px-5 py-4 text-sm">{k.name}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${k.status === "active" ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"}`}>
                        {k.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">
                      {k.last_used ? new Date(k.last_used).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {k.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(k.id)}
                          disabled={!!revoking}
                          className="text-destructive hover:text-destructive h-8 gap-1"
                        >
                          {revoking === k.id ? <Loader2 className="h-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {keys.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">No API keys found.</div>
          )}
        </div>
      )}

      {activeSection === "domains" && (
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Brand</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Domain</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Verified</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d) => (
                  <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-4 font-medium text-sm">{d.brand_name}</td>
                    <td className="px-5 py-4 font-mono text-sm">{d.domain}</td>
                    <td className="px-5 py-4">
                      {d.verified ? (
                        <span className="text-xs text-green-600">Yes</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {domains.length === 0 && (
            <div className="p-12 text-center text-muted-foreground text-sm">No allowed domains configured.</div>
          )}
        </div>
      )}
    </motion.div>
  );
}
