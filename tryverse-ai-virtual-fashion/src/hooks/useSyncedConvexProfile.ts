import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { isConvexDataEnabled } from "@/lib/convexData";

/**
 * Convex profile for the signed-in user; bootstraps via {@link api.profiles.upsertProfileForUser} when missing.
 */
export function useSyncedConvexProfile() {
  const { user } = useAuth();
  const convexOn = isConvexDataEnabled();
  const profile = useQuery(api.profiles.getMyProfile, convexOn && user ? {} : "skip");
  const upsert = useMutation(api.profiles.upsertProfileForUser);
  const [bootstrapping, setBootstrapping] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!convexOn || !user) {
      attempted.current = false;
      return;
    }
    if (profile === undefined) return;
    if (profile !== null) {
      attempted.current = false;
      return;
    }
    if (attempted.current) return;
    attempted.current = true;
    let cancelled = false;
    setBootstrapping(true);
    const acct = user.user_metadata.account_type ?? "business";
    const cap = acct === "individual" ? 5 : 20;
    void (async () => {
      try {
        await upsert({
          userId: user.id,
          patch: {
            account_type: acct,
            brand_name: user.user_metadata.brand_name,
            full_name: user.user_metadata.full_name,
            role: user.user_metadata.role,
            free_credits_remaining: cap,
            free_credits_total: cap,
          },
        });
      } catch (e) {
        console.error("ensure profile failed", e);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convexOn, user, profile, upsert]);

  if (!convexOn) {
    return { profile: null as typeof profile, loading: false, bootstrapping: false, convexOn: false };
  }

  const loading = profile === undefined || bootstrapping;
  return { profile: profile ?? null, loading, bootstrapping, convexOn: true };
}
