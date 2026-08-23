import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getCredits } from "@/lib/backendApi";

interface CreditsState {
  /** Current spendable balance — monthly plan credits if on a paid plan, else free credits. Null while loading/unknown. */
  balance: number | null;
  isUnlimited: boolean;
  loading: boolean;
  /** Re-fetches the balance from the server. Call after any generation completes so the badge reflects the real deduction. */
  refresh: () => Promise<void>;
}

const CreditsContext = createContext<CreditsState | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const credits = await getCredits();
      setIsUnlimited(credits.isUnlimited);
      setBalance(
        credits.isUnlimited
          ? null
          : credits.plan !== "free"
            ? credits.monthlyCreditsRemaining
            : credits.freeCreditsRemaining
      );
    } catch {
      // Leave the previous balance in place — a transient fetch failure shouldn't blank the badge.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <CreditsContext.Provider value={{ balance, isUnlimited, loading, refresh }}>
      {children}
    </CreditsContext.Provider>
  );
}

/** Current credit balance + a refresh() to call right after a generation completes. */
export function useCredits(): CreditsState {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits must be used within a CreditsProvider");
  return ctx;
}
