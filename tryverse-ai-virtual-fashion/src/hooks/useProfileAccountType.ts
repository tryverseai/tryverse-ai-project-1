import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { AccountType } from "@/lib/accountType";

/** Sign-up stores account_type on the JWT before profiles row may exist. */
function accountTypeFromMetadata(user: User | null): AccountType | null {
  const raw = user?.user_metadata?.account_type;
  if (raw === "individual") return "individual";
  if (raw === "business") return "business";
  return null;
}

function normalizeProfileType(value: string | null | undefined): AccountType | null {
  if (value === "individual") return "individual";
  if (value === "business") return "business";
  return null;
}

/**
 * Loads profiles.account_type for the signed-in user.
 * Falls back to JWT user_metadata (set at sign-up) when the profile row is missing
 * briefly or the first fetch races the DB trigger.
 */
export function useProfileAccountType(): {
  accountType: AccountType;
  loading: boolean;
} {
  const { user } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>("business");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccountType("business");
      setLoading(false);
      return;
    }

    const meta = accountTypeFromMetadata(user);
    if (meta) {
      setAccountType(meta);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;

    const fetchProfile = async (attempt: number): Promise<void> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        if (!meta) {
          setAccountType("business");
          setLoading(false);
        }
        return;
      }

      const fromRow = normalizeProfileType(data?.account_type ?? null);
      if (fromRow) {
        // JWT from sign-up can say individual while a stale/default profile row still says business
        // (e.g. trigger lag or older DB). Prefer individual from metadata in that conflict.
        const resolved: AccountType =
          meta === "individual" && fromRow === "business" ? "individual" : fromRow;
        setAccountType(resolved);
        if (!meta) setLoading(false);
        return;
      }

      // No row yet — common right after sign-up before handle_new_user finishes
      if (attempt < 8) {
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
        if (!cancelled) return fetchProfile(attempt + 1);
        return;
      }

      if (!meta) {
        setAccountType("business");
        setLoading(false);
      }
    };

    void fetchProfile(0);

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.user_metadata?.account_type]);

  return { accountType, loading };
}
