import { useState } from "react";
import { setConvexUrlOverride } from "@/convexReactClient";

/**
 * Shown only when no Convex deployment URL is configured (no `VITE_CONVEX_URL` build env and no
 * runtime override). Lets the app boot and collect the URL instead of crashing at import time.
 */
export const ConvexSetupScreen = () => {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setConvexUrlOverride(value)) {
      setError("Enter a full deployment URL, e.g. https://your-deployment.convex.cloud");
      return;
    }
    window.location.reload();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-foreground mb-2">Connect your Convex backend</h1>
        <p className="text-sm text-muted-foreground mb-6">
          This environment has no <code className="font-mono">VITE_CONVEX_URL</code> build variable. Paste your Convex
          deployment URL to start the app here. Production deploys should set the variable in the hosting provider.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="https://your-deployment.convex.cloud"
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="Convex deployment URL"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Save and reload
          </button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Find it in the Convex dashboard under Settings → Deployment URL.
        </p>
      </div>
    </main>
  );
};

export default ConvexSetupScreen;
