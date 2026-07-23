import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { AppUser } from "@/contexts/AuthContext";
import { normalizeAccountType, type AccountType } from "@/lib/accountType";
import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

function accountTypeFromUser(user: AppUser | null): AccountType | null {
  return normalizeAccountType(user?.user_metadata?.account_type);
}

/** Resolves `profiles.account_type` from the API (with session metadata fallback). */
export function useProfileAccountType(): {
  accountType: AccountType;
  loading: boolean;
} {
  const { user } = useAuth();
  const { profile: remoteProfile, loading: profileLoading } = useSyncedConvexProfile();
  const [accountType, setAccountType] = useState<AccountType>("business");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccountType("business");
      setLoading(false);
      return;
    }

    if (profileLoading) {
      setLoading(true);
      return;
    }

    const fromProfile = normalizeAccountType(
      typeof remoteProfile?.account_type === "string" ? remoteProfile.account_type : null
    );
    const fromMetadata = accountTypeFromUser(user);
    setAccountType(fromProfile ?? fromMetadata ?? "business");
    setLoading(false);
  }, [user, remoteProfile, profileLoading]);

  return { accountType, loading };
}
