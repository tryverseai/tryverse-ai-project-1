import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { inviteSignupEnabled, b2cSignupEnabled } from "@/lib/featureFlags";
import type { AccountType } from "@/lib/accountType";
import { complianceDoneSessionKey } from "@/lib/complianceStorage";
import { readConvexAuthJwt } from "@/lib/convexAuthStorage";

export type LegacyUserMetadata = {
  account_type?: AccountType;
  brand_name?: string;
  full_name?: string;
  role?: string;
  plan?: string;
};

/** Minimal user shape shared across dashboard and API helpers. */
export type AppUser = {
  id: string;
  email?: string;
  user_metadata: LegacyUserMetadata;
};

interface AuthContextType {
  user: AppUser | null;
  /** Convex Auth JWT for API calls; `access_token` is read from the same storage the Convex client uses. */
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();
  const sessionUser = useQuery(api.authSession.sessionUser, isAuthenticated ? {} : "skip");
  const userRow = useQuery(api.userBootstrap.myUserRow, isAuthenticated ? {} : "skip");
  const profile = useQuery(api.profiles.getMyProfile, isAuthenticated ? {} : "skip");
  const upsertProfile = useMutation(api.profiles.upsertProfileForUser);
  const [tokenTick, setTokenTick] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes("__convexAuthJWT")) setTokenTick((n) => n + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const user = useMemo((): AppUser | null => {
    if (!isAuthenticated || !sessionUser) return null;
    const rawType = String(userRow?.account_type ?? "business").toLowerCase();
    const account_type: AccountType = rawType === "individual" ? "individual" : "business";
    return {
      id: sessionUser.id,
      email: sessionUser.email ?? undefined,
      user_metadata: {
        account_type,
        brand_name: userRow?.brand_name ?? undefined,
        full_name: userRow?.full_name ?? undefined,
        role: userRow?.role ?? undefined,
      },
    };
  }, [isAuthenticated, sessionUser, userRow]);

  useEffect(() => {
    if (!user || profile === undefined) return;
    if (profile !== null) return;
    const acct = user.user_metadata.account_type ?? "business";
    const cap = acct === "individual" ? 5 : 20;
    void upsertProfile({
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
  }, [user, profile, upsertProfile]);

  const loading =
    convexAuthLoading || (isAuthenticated && (sessionUser === undefined || userRow === undefined));

  const session = useMemo(() => {
    if (!user) return null;
    const t = readConvexAuthJwt();
    if (!t) return null;
    void tokenTick;
    return { access_token: t };
  }, [user, tokenTick, isAuthenticated, loading]);

  const signUp = async (
    email: string,
    password: string,
    brandName: string,
    fullName?: string,
    role?: string,
    accountType: AccountType = "business"
  ) => {
    if (accountType === "business" && !inviteSignupEnabled) {
      return {
        error: new Error(
          "New accounts are not open yet. Join the waitlist — we’ll email you a link when your brand is approved."
        ),
        session: null,
      };
    }
    if (accountType === "individual" && !b2cSignupEnabled) {
      return {
        error: new Error("Personal sign-up is not available right now. Please try again later."),
        session: null,
      };
    }
    try {
      await convexSignIn("password", {
        flow: "signUp",
        email,
        password,
        brandName,
        fullName,
        role,
        accountType,
      } as Record<string, unknown>);
      return { error: null, session: null };
    } catch (e) {
      return { error: e as Error, session: null };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await convexSignIn("password", { flow: "signIn", email, password } as Record<string, unknown>);
      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const signOut = async () => {
    const uid = user?.id;
    await convexSignOut();
    if (uid) sessionStorage.removeItem(complianceDoneSessionKey(uid));
    setTokenTick((n) => n + 1);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
