import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { normalizeAccountType, type AccountType, type LegacyUserMetadata } from "@/lib/accountType";
import { complianceDoneSessionKey } from "@/lib/complianceStorage";
import { bootstrapLocalSession, type AccountBootstrapBody } from "@/lib/backendApi";
import {
  setBackendAuthBearerToken,
  waitForBackendAuthBearerHeader,
} from "@/lib/backendAuthBearer";
import { convexReactClient } from "@/convexReactClient";

export type { LegacyUserMetadata };

/** Minimal user shape shared across dashboard and API helpers. */
export type AppUser = {
  id: string;
  email?: string;
  user_metadata: LegacyUserMetadata;
};

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  session: { access_token: string } | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    brandName: string,
    fullName?: string,
    role?: string,
    accountType?: AccountType,
    turnstileToken?: string
  ) => Promise<{ error: Error | null; session: null }>;
  signIn: (email: string, password: string, turnstileToken?: string) => Promise<{ error: Error | null }>;
  /**
   * After Convex Auth has already signed the user in (e.g. password reset verification),
   * sync the Node API session / credits profile using the current JWT.
   */
  syncBackendSession: (opts?: {
    email?: string;
    turnstileToken?: string;
  }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeConvexAuthError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string") return new Error(err);
  try {
    return new Error(JSON.stringify(err));
  } catch {
    return new Error("Authentication failed");
  }
}

function buildPasswordFormData(
  flow: "signIn" | "signUp",
  email: string,
  password: string,
  extra?: { brandName?: string; fullName?: string; role?: string; accountType?: AccountType }
): FormData {
  const fd = new FormData();
  fd.set("flow", flow);
  fd.set("email", email.trim().toLowerCase());
  fd.set("password", password);
  if (extra?.accountType) fd.set("accountType", extra.accountType);
  if (extra?.brandName != null) fd.set("brandName", extra.brandName);
  if (extra?.fullName != null) fd.set("fullName", extra.fullName);
  if (extra?.role != null) fd.set("role", extra.role);
  return fd;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const { signIn: convexPasswordSignIn, signOut: convexSignOut } = useAuthActions();
  const token = useAuthToken();

  const sessionIdentity = useQuery(api.authSession.sessionUser, isAuthenticated ? {} : "skip");
  const userRow = useQuery(api.userBootstrap.myUserRow, isAuthenticated ? {} : "skip");

  useEffect(() => {
    setBackendAuthBearerToken(token ?? null);
  }, [token]);

  /** JWT invalid or account suspended — clear Convex session. */
  useEffect(() => {
    const clear = () => {
      void (async () => {
        try {
          await convexSignOut();
        } finally {
          setBackendAuthBearerToken(null);
        }
      })();
    };
    window.addEventListener("tryverse:auth:expired", clear);
    window.addEventListener("tryverse:auth:suspended", clear);
    return () => {
      window.removeEventListener("tryverse:auth:expired", clear);
      window.removeEventListener("tryverse:auth:suspended", clear);
    };
  }, [convexSignOut]);

  const user = useMemo((): AppUser | null => {
    if (!isAuthenticated || !sessionIdentity?.id) return null;
    const row = userRow;
    /** userRow loads after session — still show minimal user from JWT identity */
    const meta: LegacyUserMetadata = {
      account_type: row?.account_type as LegacyUserMetadata["account_type"],
      brand_name: row?.brand_name,
      full_name: row?.full_name,
      role: row?.role as string | undefined,
    };
    return {
      id: sessionIdentity.id,
      email: (sessionIdentity.email ?? row?.email) || undefined,
      user_metadata: meta,
    };
  }, [isAuthenticated, sessionIdentity, userRow]);

  const loading = convexAuthLoading || (isAuthenticated && (sessionIdentity === undefined || userRow === undefined));

  const session = useMemo(() => {
    if (!token) return null;
    return { access_token: token };
  }, [token]);

  const bootstrapAfterConvexSignIn = useCallback(async (body: AccountBootstrapBody) => {
    const header = await waitForBackendAuthBearerHeader();
    if (!header) {
      throw new Error("Could not obtain session token — try again or refresh the page.");
    }
    await bootstrapLocalSession(body);
  }, []);

  const syncBackendSession = useCallback(async (opts?: { email?: string; turnstileToken?: string }) => {
    try {
      const header = await waitForBackendAuthBearerHeader();
      if (!header) {
        throw new Error("Could not obtain session token — try again or refresh the page.");
      }
      let row: {
        account_type?: string | null;
        brand_name?: string | null;
        full_name?: string | null;
        role?: string | null;
        email?: string | null;
      } | null = null;
      for (let i = 0; i < 30; i++) {
        row = await convexReactClient.query(api.userBootstrap.myUserRow, {});
        if (row) break;
        await new Promise<void>((r) => setTimeout(r, 80));
      }
      const at = normalizeAccountType(row?.account_type as string | undefined) ?? "individual";
      const emailNorm = opts?.email?.trim().toLowerCase();
      const email =
        emailNorm ||
        (typeof row?.email === "string" ? row.email.trim().toLowerCase() : undefined);
      await bootstrapLocalSession({
        accountType: at,
        email,
        brandName: typeof row?.brand_name === "string" ? row.brand_name : undefined,
        fullName: typeof row?.full_name === "string" ? row.full_name : undefined,
        role: typeof row?.role === "string" ? row.role : undefined,
        ...(opts?.turnstileToken ? { turnstileToken: opts.turnstileToken } : {}),
      });
    } catch (e) {
      return { error: normalizeConvexAuthError(e) };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      brandName: string,
      fullName?: string,
      role?: string,
      accountType: AccountType = "business",
      turnstileToken?: string
    ) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        return { error: new Error("Email is required"), session: null };
      }
      if (!password || password.length < 6) {
        return { error: new Error("Password must be at least 6 characters."), session: null };
      }
      try {
        const fd = buildPasswordFormData("signUp", trimmed, password, {
          brandName,
          fullName,
          role,
          accountType,
        });
        await convexPasswordSignIn("password", fd);
        await bootstrapAfterConvexSignIn({
          accountType,
          brandName,
          fullName,
          role,
          email: trimmed,
          ...(turnstileToken ? { turnstileToken } : {}),
        });
      } catch (e) {
        return { error: normalizeConvexAuthError(e), session: null };
      }
      return { error: null, session: null };
    },
    [convexPasswordSignIn, bootstrapAfterConvexSignIn]
  );

  const signIn = useCallback(
    async (email: string, password: string, turnstileToken?: string) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        return { error: new Error("Email is required") };
      }
      if (!password) {
        return { error: new Error("Password is required") };
      }
      try {
        const fd = buildPasswordFormData("signIn", trimmed, password);
        await convexPasswordSignIn("password", fd);
        const synced = await syncBackendSession({ email: trimmed, turnstileToken });
        if (synced.error) return synced;
      } catch (e) {
        return { error: normalizeConvexAuthError(e) };
      }
      return { error: null };
    },
    [convexPasswordSignIn, syncBackendSession]
  );

  const signOut = useCallback(async () => {
    const uid = user?.id;
    try {
      await convexSignOut();
    } finally {
      setBackendAuthBearerToken(null);
      if (uid) sessionStorage.removeItem(complianceDoneSessionKey(uid));
    }
  }, [convexSignOut, user?.id]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(isAuthenticated && user),
      session,
      loading,
      signUp,
      signIn,
      syncBackendSession,
      signOut,
    }),
    [user, isAuthenticated, session, loading, signUp, signIn, syncBackendSession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
