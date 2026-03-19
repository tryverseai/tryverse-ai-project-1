import { useEffect, type ReactNode } from "react";
import { initPostHog, posthogIdentify, posthogReset } from "@/lib/posthog";
import { setSentryUser } from "@/lib/sentry";
import { useAuth } from "@/contexts/AuthContext";

export function PostHogProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user) {
      posthogIdentify(user.id, {
        email: user.email,
        created_at: user.created_at,
        plan: (user.user_metadata as { plan?: string })?.plan ?? "free",
      });
      setSentryUser({ id: user.id, email: user.email });
    } else {
      posthogReset();
      setSentryUser(null);
    }
  }, [user, loading]);

  return <>{children}</>;
}
