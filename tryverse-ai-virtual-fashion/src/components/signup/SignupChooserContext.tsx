import { useNavigate } from "react-router-dom";
import { createContext, useContext, useMemo, type ReactNode } from "react";

type SignupChooserCtx = {
  openSignupChooser: () => void;
};

const SignupChooserContext = createContext<SignupChooserCtx | null>(null);

/** B2B-only: “Sign Up” CTAs go straight to brand account creation. */
export function SignupChooserProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const value = useMemo(
    () => ({ openSignupChooser: () => navigate("/auth?signup=business") }),
    [navigate]
  );

  return <SignupChooserContext.Provider value={value}>{children}</SignupChooserContext.Provider>;
}

export function useSignupChooser() {
  const c = useContext(SignupChooserContext);
  if (!c) throw new Error("useSignupChooser must be used within SignupChooserProvider");
  return c;
}
