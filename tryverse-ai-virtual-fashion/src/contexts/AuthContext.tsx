import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { inviteSignupEnabled, b2cSignupEnabled } from "@/lib/featureFlags";
import type { AccountType } from "@/lib/accountType";
import { complianceDoneSessionKey } from "@/lib/complianceStorage";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    brandName: string,
    fullName?: string,
    role?: string,
    accountType?: AccountType
  ) => Promise<{ error: Error | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: {
          brand_name: brandName,
          full_name: fullName || "",
          role: role || "",
          account_type: accountType,
        },
      },
    });
    if (error) {
      return { error: error as Error, session: null };
    }
    let session = data.session ?? null;
    // If "Confirm email" is off, Supabase usually returns a session on signUp. If not, try one sign-in
    // so the client has a session and can load the dashboard without a confirmation round-trip.
    if (!session) {
      const signInRes = await supabase.auth.signInWithPassword({ email, password });
      if (!signInRes.error) {
        session = signInRes.data.session;
      }
    }
    return { error: null, session };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session) {
      // Ensure JWT + user_metadata (e.g. account_type) are available to hooks immediately after sign-in.
      await supabase.auth.getUser();
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    await supabase.auth.signOut();
    if (uid) sessionStorage.removeItem(complianceDoneSessionKey(uid));
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
