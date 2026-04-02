import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { AccountType } from "@/lib/accountType";

/** Sign-up stores account_type on the JWT before profiles row may exist. */
function accountTypeFromMetadata(user: User | null): AccountType | null {
  const raw = user?.user_metadata?.account_type;
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (s === "individual") return "individual";
  if (s === "business" || s === "brand") return "business";
  return null;
}

function normalizeProfileType(value: string | null | undefined): AccountType | null {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (s === "individual") return "individual";
  if (s === "business" || s === "brand") return "business";
  return null;
}

/**
 * Loads profiles.account_type for the signed-in user.
 * The profiles row is the source of truth for routing (dashboard individual vs business).
 * Metadata is only used while the row is missing (short window after sign-up).
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
    let cancelled = false;

    const fetchProfile = async (attempt: number): Promise<void> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setAccountType(meta ?? "business");
        setLoading(false);
        return;
      }

      const fromRow = normalizeProfileType(data?.account_type ?? null);
      if (fromRow) {
        setAccountType(fromRow);
        setLoading(false);
        return;
      }

      if (attempt < 8) {
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
        if (!cancelled) return fetchProfile(attempt + 1);
        return;
      }

      setAccountType(meta ?? "business");
      setLoading(false);
    };

    setLoading(true);
    void fetchProfile(0);

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.user_metadata?.account_type]);

  return { accountType, loading };
}
