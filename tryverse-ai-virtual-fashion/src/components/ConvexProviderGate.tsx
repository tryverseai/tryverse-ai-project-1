import { type ReactNode } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { convexReactClient } from "@/lib/convexClient";

/**
 * Convex Auth + data. Requires `VITE_CONVEX_URL` and Convex dashboard auth env (JWT keys, CONVEX_SITE_URL).
 */
export function ConvexProviderGate({ children }: { children: ReactNode }) {
  if (!convexReactClient) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
        Set <code className="mx-1 rounded bg-muted px-1">VITE_CONVEX_URL</code> in <code className="mx-1 rounded bg-muted px-1">.env</code> and restart the dev server.
      </div>
    );
  }

  return (
    <ConvexAuthProvider
      client={convexReactClient}
      shouldHandleCode={() => typeof window !== "undefined" && !window.location.pathname.startsWith("/reset-password")}
    >
      {children}
    </ConvexAuthProvider>
  );
}
