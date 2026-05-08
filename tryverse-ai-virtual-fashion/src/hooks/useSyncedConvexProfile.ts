import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getMyAccount } from "@/lib/backendApi";

/** Profile row shape from GET /api/account/me (Convex-backed on the server). */
export type RemoteProfileRow = Record<string, unknown> | null;

/**
 * Loads the signed-in user's profile via the TryVerse API (no browser Convex client).
 */
export function useSyncedConvexProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<RemoteProfileRow>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    try {
      const me = await getMyAccount();
      setProfile(me.profile ?? null);
    } catch {
      setProfile(null);
    }
  }, [user]);

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

  /** Poll while waiting for beta approval so the overlay can dismiss without refresh. */
  useEffect(() => {
    const p = profile as Record<string, unknown> | null;
    if (!user || !p || p.beta_approved !== false) return undefined;
    const id = window.setInterval(() => {
      void reload();
    }, 12_000);
    return () => clearInterval(id);
  }, [user, profile, reload]);

  return {
    profile,
    loading,
    bootstrapping: false,
    convexOn: false,
    refetchProfile: reload,
  };
}
