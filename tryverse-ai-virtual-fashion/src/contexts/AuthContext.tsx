import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clearLocalSession,
  emailToLocalSubject,
  encodeLocalAuthorizationHeader,
  ensureGuestLocalSession,
  readLocalSession,
  writeLocalSession,
  isGuestLocalSession,
  type LocalSessionV2,
} from "@/lib/localSession";
import { normalizeAccountType, type AccountType, type LegacyUserMetadata } from "@/lib/accountType";
import { complianceDoneSessionKey } from "@/lib/complianceStorage";
import { bootstrapLocalSession, type AccountBootstrapBody } from "@/lib/backendApi";

export type { LegacyUserMetadata };

/** Minimal user shape shared across dashboard and API helpers. */
export type AppUser = {
  id: string;
  email?: string;
  user_metadata: LegacyUserMetadata;
};

interface AuthContextType {
  user: AppUser | null;
  /** False for anonymous `local:guest-…` sessions created after sign-out or first visit. */
  isAuthenticated: boolean;
  session: { access_token: string } | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    brandName: string,
    fullName?: string,
    role?: string,
    accountType?: AccountType
  ) => Promise<{ error: Error | null; session: null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sessionToAppUser(s: LocalSessionV2): AppUser {
  return {
    id: s.sub,
    email: s.email || undefined,
    user_metadata: s.user_metadata || {},
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (typeof window !== "undefined") {
    ensureGuestLocalSession();
  }
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const forceSignOut = () => {
      clearLocalSession();
      setTick((n) => n + 1);
    };
    window.addEventListener("tryverse:auth:expired", forceSignOut);
    window.addEventListener("tryverse:auth:suspended", forceSignOut);
    return () => {
      window.removeEventListener("tryverse:auth:expired", forceSignOut);
      window.removeEventListener("tryverse:auth:suspended", forceSignOut);
    };
  }, []);

  const user = useMemo((): AppUser | null => {
    void tick;
    const s = readLocalSession();
    if (!s) return null;
    return sessionToAppUser(s);
  }, [tick]);

  const isAuthenticated = useMemo(() => {
    void tick;
    const s = readLocalSession();
    if (!s) return false;
    return !isGuestLocalSession(s);
  }, [tick]);

  const loading = false;

  const session = useMemo(() => {
    void tick;
    const h = encodeLocalAuthorizationHeader();
    if (!h) return null;
    return { access_token: h };
  }, [tick]);

  const signUp = async (
    email: string,
    _password: string,
    brandName: string,
    fullName?: string,
    role?: string,
    accountType: AccountType = "business"
  ) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return { error: new Error("Email is required"), session: null };
    }
    const sub = emailToLocalSubject(trimmed);
    const meta: LegacyUserMetadata = {
      account_type: accountType,
      brand_name: brandName,
      full_name: fullName,
      role,
    };
    writeLocalSession({ sub, email: trimmed, user_metadata: meta });
    setTick((n) => n + 1);

    const body: AccountBootstrapBody = {
      accountType,
      brandName,
      fullName,
      role,
      email: trimmed,
    };
    try {
      await bootstrapLocalSession(body);
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)), session: null };
    }
    return { error: null, session: null };
  };

  const signIn = async (email: string, _password: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      return { error: new Error("Email is required") };
    }
    const sub = emailToLocalSubject(trimmed);
    const existing = readLocalSession();
    const meta: LegacyUserMetadata =
      existing?.sub === sub && existing.user_metadata
        ? existing.user_metadata
        : { account_type: "individual", full_name: trimmed.split("@")[0] };
    writeLocalSession({ sub, email: trimmed, user_metadata: meta });
    setTick((n) => n + 1);

    try {
      await bootstrapLocalSession({
        accountType: normalizeAccountType(meta.account_type) ?? "individual",
        email: trimmed,
        brandName: meta.brand_name,
        fullName: meta.full_name,
        role: meta.role,
      });
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
    return { error: null };
  };

  const signOut = async () => {
    const uid = user?.id;
    clearLocalSession();
    if (uid) sessionStorage.removeItem(complianceDoneSessionKey(uid));
    ensureGuestLocalSession();
    setTick((n) => n + 1);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
