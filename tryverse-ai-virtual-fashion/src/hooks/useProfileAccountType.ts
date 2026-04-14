import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { AppUser } from "@/contexts/AuthContext";
import { normalizeAccountType, type AccountType } from "@/lib/accountType";
import { isConvexDataEnabled } from "@/lib/convexData";
import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

function accountTypeFromUser(user: AppUser | null): AccountType | null {
  return normalizeAccountType(user?.user_metadata?.account_type);
}

/** Loads `profiles.account_type` from Convex (with JWT metadata fallback). */
export function useProfileAccountType(): {
  accountType: AccountType;
  loading: boolean;
} {
  const { user } = useAuth();
  const convexOn = isConvexDataEnabled();
  const { profile: cxProfile, loading: cxLoading } = useSyncedConvexProfile();
  const [accountType, setAccountType] = useState<AccountType>("business");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccountType("business");
      setLoading(false);
      return;
    }

    if (!convexOn) {
      setAccountType(accountTypeFromUser(user) ?? "business");
      setLoading(false);
      return;
    }

    if (cxLoading) {
      setLoading(true);
      return;
    }

    const fromProfile = normalizeAccountType(cxProfile?.account_type ?? null);
    const fromMetadata = accountTypeFromUser(user);
    setAccountType(fromProfile ?? fromMetadata ?? "business");
    setLoading(false);
  }, [user, convexOn, cxProfile, cxLoading]);

  return { accountType, loading };
}
