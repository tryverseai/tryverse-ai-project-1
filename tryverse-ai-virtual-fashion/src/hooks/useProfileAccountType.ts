import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { AccountType } from "@/lib/accountType";

/**
 * Loads profiles.account_type for the signed-in user (Supabase).
 * Defaults to business when missing (legacy rows) or on error.
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

    let cancelled = false;
    setLoading(true);

    void supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.account_type) {
          setAccountType("business");
          return;
        }
        const t = data.account_type as string;
        setAccountType(t === "individual" ? "individual" : "business");
      })
      .catch(() => {
        if (!cancelled) setAccountType("business");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { accountType, loading };
}
