import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SignupAccountTypeModal } from "./SignupAccountTypeModal";

type SignupChooserCtx = {
  openSignupChooser: () => void;
};

const SignupChooserContext = createContext<SignupChooserCtx | null>(null);

/** Wraps marketing routes so “Sign Up” CTAs share one account-type modal. */
export function SignupChooserProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ openSignupChooser: () => setOpen(true) }), []);

  return (
    <SignupChooserContext.Provider value={value}>
      {children}
      <SignupAccountTypeModal open={open} onOpenChange={setOpen} />
    </SignupChooserContext.Provider>
  );
}

export function useSignupChooser() {
  const c = useContext(SignupChooserContext);
  if (!c) throw new Error("useSignupChooser must be used within SignupChooserProvider");
  return c;
}
