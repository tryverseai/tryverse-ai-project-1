import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { AppUser } from "@/contexts/AuthContext";
import type { AccountType } from "@/lib/accountType";
import { isConvexDataEnabled } from "@/lib/convexData";
import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

function accountTypeFromMetadata(user: AppUser | null): AccountType | null {
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
      setAccountType(accountTypeFromMetadata(user) ?? "business");
      setLoading(false);
      return;
    }

    if (cxLoading) {
      setLoading(true);
      return;
    }
    const meta = accountTypeFromMetadata(user);
    const fromRow = normalizeProfileType(cxProfile?.account_type ?? null);
    setAccountType(fromRow ?? meta ?? "business");
    setLoading(false);
  }, [user, convexOn, cxProfile, cxLoading]);

  return { accountType, loading };
}
