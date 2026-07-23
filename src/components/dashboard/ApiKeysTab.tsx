import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Key, FileText, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * API key CRUD previously used Convex from the browser. With local sessions, key management
 * will move to a dedicated REST surface; until then this tab is informational.
 */
export function ApiKeysTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">Integration credentials for your storefront</p>
        </div>
        <Link to="/api-docs">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" /> API Reference
          </Button>
        </Link>
      </div>

      <div className="bg-muted/50 border border-border/50 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Shield className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">Keys are not managed in the browser anymore</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and revoke keys from a trusted admin flow or upcoming `/api/account/api-keys` endpoints. Never
            embed secrets in client-side code.
          </p>
        </div>
      </div>

      <div className="text-center py-16 bg-card rounded-xl border border-border/50">
        <Key className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          API key generation from the dashboard is temporarily unavailable while authentication is simplified. Use the
          API documentation for integration shapes; contact support if you need a key issued manually.
        </p>
      </div>
    </motion.div>
  );
}
