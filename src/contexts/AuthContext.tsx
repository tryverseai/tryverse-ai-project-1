import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { normalizeAccountType, type AccountType, type LegacyUserMetadata } from "@/lib/accountType";
import type { PendingEmailVerificationBootstrap } from "@/lib/emailVerifyPendingStorage";
import { complianceDoneSessionKey } from "@/lib/complianceStorage";
import {
  bootstrapLocalSession,
  BootstrapDeviceApprovalRequiredError,
  type AccountBootstrapBody,
} from "@/lib/backendApi";
import { getOrCreateDeviceFingerprint } from "@/lib/deviceFingerprint";
import {
  setBackendAuthBearerToken,
  waitForBackendAuthBearerHeader,
} from "@/lib/backendAuthBearer";
import { convexReactClient } from "@/convexReactClient";
import { useIdleSessionLogout, DEFAULT_APP_SESSION_IDLE_MS } from "@/hooks/useIdleSessionLogout";

export type { LegacyUserMetadata };
export type { PendingEmailVerificationBootstrap };

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
    accountType?: AccountType
  ) => Promise<
    | { error: Error; session: null }
    | {
        error: null;
        session: null;
        needsEmailVerification: true;
        pendingEmail: string;
        pendingBootstrap: PendingEmailVerificationBootstrap;
      }
    | { error: null; session: null; deviceApprovalRequired: true; pendingEmail: string }
    | { error: null; session: null }
  >;
  signIn: (
    email: string,
    password: string
  ) => Promise<
    | { error: Error }
    | {
        error: null;
        needsEmailVerification: true;
        pendingEmail: string;
        reuseVerificationCodeHint?: true;
      }
    | { error: null; deviceApprovalRequired: true; pendingEmail: string }
    | { error: null }
  >;
  /** Complete password `email-verification` step after Convex sends the OTP (8-digit code). */
  verifyEmailWithCode: (
    email: string,
    code: string,
    opts?: { pendingBootstrap?: PendingEmailVerificationBootstrap }
  ) => Promise<{ error: Error | null; deviceApprovalRequired?: boolean }>;
  /**
   * After Convex Auth has already signed the user in (e.g. password reset verification),
   * sync the Node API session / credits profile using the current JWT.
   */
  syncBackendSession: (opts?: {
    email?: string;
  }) => Promise<{ error: Error | null; deviceApprovalRequired?: true }>;
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

/** Noisy Convex Auth / password sign-in errors → one line for the sign-in form. */
const SIGN_IN_FRIENDLY =
  /invalidaccountid|invalid\s*account|credentialssignin|invalid\s*credentials?|incorrect\s*password|wrong\s*password|user\s*not\s*found|no\s*user|account\s*not\s*found|email\s*(?:is\s*)?not\s*found|invalid\s*login|authentication\s*failed/i;

export function humanizeSignInPasswordError(err: unknown): Error {
  const inner = normalizeConvexAuthError(err);
  const m = inner.message.replace(/\s+/g, " ").trim();
  if (!m) return new Error("Invalid account or password.");
  if (SIGN_IN_FRIENDLY.test(m)) {
    return new Error("Invalid account or password.");
  }
  if (
    /convex|server error|uncaught error|request id:/i.test(m) &&
    /auth|signin|sign[\s_-]*in|password|account|credential/i.test(m)
  ) {
    return new Error("Invalid account or password.");
  }
  return inner;
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

function requireDeviceFingerprint(): string {
  const fp = getOrCreateDeviceFingerprint();
  if (fp.length < 8) {
    throw new Error("Could not identify this browser. Enable local storage and reload the page.");
  }
  return fp;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const { signIn: convexPasswordSignIn, signOut: convexSignOut } = useAuthActions();
  const token = useAuthToken();

  const sessionIdentity = useQuery(api.authSession.sessionUser, isAuthenticated ? {} : "skip");
  const userRow = useQuery(api.userBootstrap.myUserRow, isAuthenticated ? {} : "skip");

  useLayoutEffect(() => {
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

  const bootstrapAfterConvexSignIn = useCallback(async (body: Omit<AccountBootstrapBody, "deviceFingerprint">) => {
    const header = await waitForBackendAuthBearerHeader();
    if (!header) {
      throw new Error("Could not obtain session token — try again or refresh the page.");
    }
    const deviceFingerprint = requireDeviceFingerprint();
    await bootstrapLocalSession({ ...body, deviceFingerprint });
  }, []);

  const syncBackendSession = useCallback(async (opts?: { email?: string }) => {
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
      const deviceFingerprint = requireDeviceFingerprint();
      await bootstrapLocalSession({
        accountType: at,
        email,
        brandName: typeof row?.brand_name === "string" ? row.brand_name : undefined,
        fullName: typeof row?.full_name === "string" ? row.full_name : undefined,
        role: typeof row?.role === "string" ? row.role : undefined,
        deviceFingerprint,
      });
    } catch (e) {
      if (e instanceof BootstrapDeviceApprovalRequiredError) {
        return { error: null, deviceApprovalRequired: true as const };
      }
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
      accountType: AccountType = "business"
    ) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        return { error: new Error("Email is required"), session: null };
      }
      if (!password || password.length < 6) {
        return { error: new Error("Password must be at least 10 characters."), session: null };
      }
      try {
        const fd = buildPasswordFormData("signUp", trimmed, password, {
          brandName,
          fullName,
          role,
          accountType,
        });
        const result = await convexPasswordSignIn("password", fd);
        if (!result.signingIn) {
          return {
            error: null,
            session: null,
            needsEmailVerification: true as const,
            pendingEmail: trimmed,
            pendingBootstrap: {
              accountType,
              brandName,
              fullName,
              role,
            },
          };
        }
        await bootstrapAfterConvexSignIn({
          accountType,
          brandName,
          fullName,
          role,
          email: trimmed,
        });
      } catch (e) {
        if (e instanceof BootstrapDeviceApprovalRequiredError) {
          return { error: null, session: null, deviceApprovalRequired: true as const, pendingEmail: trimmed };
        }
        return { error: normalizeConvexAuthError(e), session: null };
      }
      return { error: null, session: null };
    },
    [convexPasswordSignIn, bootstrapAfterConvexSignIn]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) {
        return { error: new Error("Email is required") };
      }
      if (!password) {
        return { error: new Error("Password is required") };
      }
      try {
        const fd = buildPasswordFormData("signIn", trimmed, password);
        const result = await convexPasswordSignIn("password", fd);
        if (!result.signingIn) {
          return { error: null, needsEmailVerification: true as const, pendingEmail: trimmed };
        }
        const synced = await syncBackendSession({ email: trimmed });
        if (synced.error) return synced;
        if (synced.deviceApprovalRequired) {
          return { error: null, deviceApprovalRequired: true as const, pendingEmail: trimmed };
        }
      } catch (e) {
        const raw = normalizeConvexAuthError(e);
        if (raw.message.includes("[TRYVERSE_EMAIL_UNVERIFIED_SIGNIN]")) {
          return {
            error: null,
            needsEmailVerification: true as const,
            pendingEmail: trimmed,
            reuseVerificationCodeHint: true as const,
          };
        }
        return { error: humanizeSignInPasswordError(raw) };
      }
      return { error: null };
    },
    [convexPasswordSignIn, syncBackendSession]
  );

  const verifyEmailWithCode = useCallback(
    async (
      email: string,
      code: string,
      opts?: { pendingBootstrap?: PendingEmailVerificationBootstrap }
    ) => {
      const trimmed = email.trim().toLowerCase();
      const c = code.trim().replace(/\s+/g, "");
      if (!trimmed) {
        return { error: new Error("Email is required") };
      }
      if (!c) {
        return { error: new Error("Enter the verification code from your email.") };
      }
      try {
        const fd = new FormData();
        fd.set("email", trimmed);
        fd.set("code", c);
        fd.set("flow", "email-verification");
        const result = await convexPasswordSignIn("password", fd);
        if (!result.signingIn) {
          return {
            error: new Error(
              "That code didn’t work or may have expired. Go back, sign up or sign in again, and use the newest code from your email."
            ),
          };
        }
        if (opts?.pendingBootstrap) {
          const b = opts.pendingBootstrap;
          try {
            await bootstrapAfterConvexSignIn({
              accountType: b.accountType,
              brandName: b.brandName,
              fullName: b.fullName,
              role: b.role,
              email: trimmed,
            });
          } catch (e) {
            if (e instanceof BootstrapDeviceApprovalRequiredError) {
              return { error: null, deviceApprovalRequired: true };
            }
            return { error: normalizeConvexAuthError(e) };
          }
        } else {
          const synced = await syncBackendSession({ email: trimmed });
          if (synced.error) return synced;
          if (synced.deviceApprovalRequired) return { error: null, deviceApprovalRequired: true };
        }
      } catch (e) {
        return { error: normalizeConvexAuthError(e) };
      }
      return { error: null };
    },
    [convexPasswordSignIn, bootstrapAfterConvexSignIn, syncBackendSession]
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

  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;

  useIdleSessionLogout(
    Boolean(user),
    DEFAULT_APP_SESSION_IDLE_MS,
    useCallback(() => void signOutRef.current(), [])
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(isAuthenticated && user),
      session,
      loading,
      signUp,
      signIn,
      verifyEmailWithCode,
      syncBackendSession,
      signOut,
    }),
    [user, isAuthenticated, session, loading, signUp, signIn, verifyEmailWithCode, syncBackendSession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
