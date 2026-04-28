import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getMyAccount } from "@/lib/backendApi";

/** Profile row shape from GET /api/account/me (Convex-backed on the server). */
export type RemoteProfileRow = Record<string, unknown> | null;

/**
 * Loads the signed-in user's profile via the TryVerse API (no browser Convex client).
 */
export function useSyncedConvexProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<RemoteProfileRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const me = await getMyAccount();
        if (!cancelled) setProfile(me.profile ?? null);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return {
    profile,
    loading,
    bootstrapping: false,
    convexOn: false,
  };
}
