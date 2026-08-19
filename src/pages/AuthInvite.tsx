import { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Building2, Mail, Lock, User, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { posthogCapture } from "@/lib/posthog";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { safeInAppRedirectPath } from "@/lib/safeUrl";
import { completeInviteAfterSignup, validateInviteToken } from "@/lib/backendApi";
import { dashboardPathForAccountType, type AccountType } from "@/lib/accountType";
import { useSignupChooser } from "@/components/signup/SignupChooserContext";
import { saveEmailVerifyPending } from "@/lib/emailVerifyPendingStorage";
import { convexAuthEmailFlowToast } from "@/lib/convexAuthEmailFlowToast";

function signUpErrorToast(error: Error): {
  title: string;
  description: string;
  variant: "default" | "destructive";
} {
  const wrapped = convexAuthEmailFlowToast(error, "signup");
  if (wrapped) return wrapped;

  const raw = error.message || "";
  const msg = raw.toLowerCase();
  const isResendTestModeOnly =
    msg.includes("only send testing emails") ||
    (msg.includes("resend") && msg.includes("verify a domain")) ||
    (msg.includes("403") && msg.includes("validation_error"));

  if (isResendTestModeOnly) {
    return {
      title: "Resend is in test mode",
      description:
        "With Resend’s free tier you can only send to the email on your Resend account (check the error for the exact address). Sign up with that email to test, or verify a domain at resend.com/domains and set AUTH_EMAIL_FROM on Convex to a sender on that domain.",
      variant: "default",
    };
  }

  return {
    title: "Sign up failed",
    description: error.message,
    variant: "destructive",
  };
}

/** Convex + API use `personal`; app session uses `individual`. */
function inviteKindToBootstrapType(kind: "personal" | "business"): AccountType {
  return kind === "personal" ? "individual" : "business";
}

const AuthInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchChecked, setSearchChecked] = useState(false);
  const [gateLoading, setGateLoading] = useState(true);
  const [gateValid, setGateValid] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  /** Convex lifecycle shape; legacy env tokens resolve as business. */
  const [inviteKind, setInviteKind] = useState<"personal" | "business" | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();
  const { openSignupChooser } = useSignupChooser();

  useEffect(() => {
    if (!FEATURE_FLAGS.INVITE_ONLY_MODE) {
      navigate("/auth", { replace: true });
      return;
    }
    const redirectParam = searchParams.get("redirect");
    if (redirectParam) {
      sessionStorage.setItem("tryverse_redirect", safeInAppRedirectPath(redirectParam, "/dashboard"));
    }
    setSearchChecked(true);
  }, [navigate, searchParams]);

  useEffect(() => {
    if (!searchChecked || !FEATURE_FLAGS.INVITE_ONLY_MODE) return;
    let cancelled = false;
    (async () => {
      if (!token?.trim()) {
        setGateValid(false);
        setInviteKind(null);
        setGateLoading(false);
        return;
      }
      setGateLoading(true);
      try {
        const res = await validateInviteToken(token.trim());
        if (cancelled) return;
        const valid = Boolean(res.valid);
        setGateValid(valid);
        if (valid && "email" in res && res.email) {
          setInviteEmail(res.email);
          setEmail(res.email);
          const apiKind =
            res.accountType === "personal" ? ("personal" as const) : ("business" as const);
          setInviteKind(apiKind);
          if (typeof res.name === "string" && res.name.trim()) {
            setFullName(res.name.trim());
          }
          if (typeof res.companyName === "string" && res.companyName.trim()) {
            setCompanyName(res.companyName.trim());
          }
        } else {
          setInviteKind(null);
        }
      } catch {
        if (!cancelled) {
          setGateValid(false);
          setInviteKind(null);
        }
      } finally {
        if (!cancelled) setGateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchChecked, token]);

  const goToAccountDashboard = (acct: AccountType) => {
    const rp = searchParams.get("redirect");
    sessionStorage.removeItem("tryverse_redirect");
    const defaultPath = dashboardPathForAccountType(acct);
    if (rp) {
      const resolved = safeInAppRedirectPath(rp, defaultPath);
      navigate(resolved, { replace: true });
      return;
    }
    navigate(defaultPath, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateValid || !inviteKind || !token?.trim()) return;

    const acctBootstrap = inviteKindToBootstrapType(inviteKind);

    if (inviteKind === "business" && !companyName.trim()) {
      toast({
        title: "Company required",
        description: "Enter your company name to continue.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const signResult =
        inviteKind === "personal"
          ? await signUp(
              email,
              password,
              fullName.trim() || "My Try-Ons",
              fullName.trim(),
              undefined,
              "individual"
            )
          : await signUp(email, password, companyName.trim(), fullName.trim(), undefined, "business");

      if (signResult.error) {
        console.error("Signup error:", signResult.error);
        const t = signUpErrorToast(signResult.error);
        toast({ title: t.title, description: t.description, variant: t.variant, duration: 9000 });
        return;
      }

      if ("needsEmailVerification" in signResult && signResult.needsEmailVerification) {
        saveEmailVerifyPending({
          email: (signResult as unknown as { pendingEmail: string }).pendingEmail,
          pendingBootstrap: (signResult as unknown as { pendingBootstrap?: never }).pendingBootstrap,
          inviteToken: token.trim(),
          accountTypeAfterInvite: acctBootstrap,
        });
        toast({
          title: "Check your email",
          description: "We sent an 8-digit code. Continue on the verification page to finish setting up.",
          duration: 9000,
        });
        setPassword("");
        navigate("/auth/verify-email");
        return;
      }

      try {
        await completeInviteAfterSignup(token.trim(), email);
      } catch (err) {
        toast({
          title: "Account created",
          description:
            err instanceof Error
              ? `${err.message}. You’re signed in; if this persists, contact info@tryverseai.com`
              : "We could not mark the invitation as used. You're signed in — contact info@tryverseai.com if this persists.",
          variant: "default",
          duration: 9000,
        });
      }

      posthogCapture("user_signed_up", {
        email,
        account_type: acctBootstrap,
        via: "lifecycle_invite",
      });
      toast({ title: "Welcome!", description: "Your account is ready.", duration: 6000 });
      setPassword("");
      goToAccountDashboard(acctBootstrap);
    } finally {
      setLoading(false);
    }
  };

  if (!FEATURE_FLAGS.INVITE_ONLY_MODE) return null;

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 bg-black items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 max-w-md">
          <div className="flex justify-center mb-8">
            <Link to="/" className="inline-block">
              <TryVerseLogo height={56} invert />
            </Link>
          </div>
          <h2 className="font-display text-4xl font-bold text-primary-foreground mb-4 leading-tight">
            The AI infrastructure for virtual try-on
          </h2>
          <p className="text-primary-foreground/60 text-lg leading-relaxed">
            Built for modern fashion brands ready to increase conversions, reduce returns, and delight customers.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 pt-8 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 lg:hidden">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 min-h-11 min-w-11 -ml-2 px-2 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
              Back to sign in
            </Link>
          </div>

          {gateLoading ? (
            <p className="text-sm text-muted-foreground">Checking your invitation…</p>
          ) : !gateValid ? (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-foreground">Invitation unavailable</h1>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {`This invitation link is invalid or has already been used.\nIf you believe this is an error, please contact info@tryverseai.com`}
              </p>
              <Button
                type="button"
                className="w-full gradient-primary text-primary-foreground h-12 shadow-soft"
                onClick={() => openSignupChooser()}
              >
                Sign Up
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link to="/auth" className="text-foreground font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                {inviteKind === "personal" ? "Create your TryVerse account" : "Activate your business access"}
              </h1>
              <p className="text-muted-foreground mb-6">
                Complete setup with the email on your invitation ({inviteEmail}).
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    className="pl-10 h-12 bg-muted/40"
                    required
                    readOnly
                    autoComplete="email"
                    aria-readonly
                  />
                </div>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
                {inviteKind === "business" && (
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Company name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                )}
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-primary text-primary-foreground h-12 shadow-soft"
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Please wait…
                    </>
                  ) : (
                    <>
                      {inviteKind === "personal" ? "Create My Account" : "Activate Business Account"}
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-sm text-muted-foreground text-center mt-4">
                Already have an account?{" "}
                <Link to="/auth" className="text-foreground font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AuthInvite;
