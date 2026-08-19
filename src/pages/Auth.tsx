import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Building2, Mail, Lock, User, Briefcase, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { posthogCapture } from "@/lib/posthog";
import { inviteSignupEnabled, b2cSignupEnabled, FEATURE_FLAGS } from "@/lib/featureFlags";
import { postLoginRedirectPath, safeInAppRedirectPath } from "@/lib/safeUrl";
import { Label } from "@/components/ui/label";
import { useSignupChooser } from "@/components/signup/SignupChooserContext";
import { saveEmailVerifyPending } from "@/lib/emailVerifyPendingStorage";
import { convexAuthEmailFlowToast } from "@/lib/convexAuthEmailFlowToast";

const roles = [
  "Founder",
  "Developer",
  "Ecommerce Manager",
  "Marketing Manager",
  "Product Manager",
  "Other",
];

/** Map provider/email errors to friendly copy for sign-up toasts. */
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

/** Brand / B2B invite signup: ?signup=true | business | invite */
function hasBusinessInviteSignupParam(searchParams: URLSearchParams) {
  const s = searchParams.get("signup");
  return s === "true" || s === "invite" || s === "business";
}

const Auth = () => {
  const [searchParams] = useSearchParams();
  const inviteOnly = FEATURE_FLAGS.INVITE_ONLY_MODE;
  const wantsBusinessInvite = hasBusinessInviteSignupParam(searchParams);
  /** Brand signup form — gated by invite env flags only; invite-only mode no longer disables /auth signup (beta gate handles access). */
  const showBusinessSignupForm = wantsBusinessInvite && inviteSignupEnabled;
  /** Business self-serve disabled but user landed on business signup URL — show paused messaging */
  const businessSignupPaused = wantsBusinessInvite && !inviteSignupEnabled;

  const wantsIndividualSignup = searchParams.get("signup") === "individual";
  const showIndividualSignupForm = wantsIndividualSignup && b2cSignupEnabled;
  const individualSignupPaused = wantsIndividualSignup && !b2cSignupEnabled;

  const signupPausedToastSent = useRef(false);

  const redirectParam = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [brandName, setBrandName] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openSignupChooser } = useSignupChooser();

  useEffect(() => {
    if (redirectParam) {
      sessionStorage.setItem("tryverse_redirect", safeInAppRedirectPath(redirectParam, "/dashboard"));
    }
  }, [redirectParam]);

  /** Brand invite: same notification when business sign-up isn’t available */
  useEffect(() => {
    if (!businessSignupPaused || signupPausedToastSent.current) return;
    signupPausedToastSent.current = true;
    toast({
      title: "Sign up isn’t open yet",
      description:
        "Complete the interest form first. When we approve your brand, we’ll email you a link to create your TryVerse account.",
      duration: 11000,
    });
  }, [businessSignupPaused, toast]);

  const goToDashboardAfterAuth = () => {
    if (redirectParam) sessionStorage.removeItem("tryverse_redirect");
    const nextPath = postLoginRedirectPath(
      redirectParam || sessionStorage.getItem("tryverse_redirect") || "/dashboard"
    );
    const resolved = new URL(nextPath, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    const pathOnly = resolved.pathname;
    // Always enter through /dashboard so DashboardHomeRedirect + AccountTypeGate use DB account_type.
    if (
      pathOnly === "/dashboard" ||
      pathOnly.startsWith("/dashboard/business") ||
      pathOnly.startsWith("/dashboard/individual")
    ) {
      navigate(
        { pathname: "/dashboard", search: resolved.search, hash: resolved.hash },
        { replace: true }
      );
      return;
    }
    navigate(
      { pathname: resolved.pathname, search: resolved.search, hash: resolved.hash },
      { replace: true }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (showIndividualSignupForm) {
      const result = await signUp(
        email,
        password,
        fullName.trim() || "My Try-Ons",
        fullName,
        undefined,
        "individual"
      );
      if (result.error) {
        console.error("Signup error:", result.error);
        const t = signUpErrorToast(result.error);
        toast({ title: t.title, description: t.description, variant: t.variant, duration: 15000 });
      } else if ("deviceApprovalRequired" in result && result.deviceApprovalRequired) {
        saveEmailVerifyPending({ email: result.pendingEmail });
        toast({
          title: "Approve this browser next",
          description:
            "You’re signed in. On the next screen, tap “Email me a code” and enter the 6-digit approval we send to your inbox.",
          duration: 10000,
        });
        setPassword("");
        navigate("/auth/approve-device");
      } else if ("needsEmailVerification" in result && result.needsEmailVerification) {
        saveEmailVerifyPending({
          email: result.pendingEmail,
          pendingBootstrap: result.pendingBootstrap,
        });
        toast({
          title: "Check your email",
          description:
            "We sent a welcome email with your 8-digit verification code. Open it, then continue on the verification page to activate your account.",
          duration: 9000,
        });
        setPassword("");
        navigate("/auth/verify-email");
      } else {
        posthogCapture("user_signed_up", { email, account_type: "individual" });
        toast({ title: "Welcome!", description: "Your account is ready.", duration: 6000 });
        setPassword("");
        goToDashboardAfterAuth();
      }
    } else if (showBusinessSignupForm) {
      const finalRole = role === "Other" ? customRole : role;
      const result = await signUp(email, password, brandName, fullName, finalRole, "business");
      if (result.error) {
        console.error("Signup error:", result.error);
        const t = signUpErrorToast(result.error);
        toast({ title: t.title, description: t.description, variant: t.variant, duration: 15000 });
      } else if ("deviceApprovalRequired" in result && result.deviceApprovalRequired) {
        saveEmailVerifyPending({ email: result.pendingEmail });
        toast({
          title: "Approve this browser next",
          description:
            "You’re signed in. On the next screen, tap “Email me a code” and enter the 6-digit approval we send to your inbox.",
          duration: 10000,
        });
        setPassword("");
        navigate("/auth/approve-device");
      } else if ("needsEmailVerification" in result && result.needsEmailVerification) {
        saveEmailVerifyPending({
          email: result.pendingEmail,
          pendingBootstrap: result.pendingBootstrap,
        });
        toast({
          title: "Check your email",
          description:
            "We sent a welcome email with your 8-digit verification code. Open it, then continue on the verification page to activate your account.",
          duration: 9000,
        });
        setPassword("");
        navigate("/auth/verify-email");
      } else {
        posthogCapture("user_signed_up", { email, account_type: "business" });
        toast({ title: "Welcome!", description: "Your account is ready.", duration: 6000 });
        setPassword("");
        goToDashboardAfterAuth();
      }
    } else {
      const result = await signIn(email, password);
      if (result.error) {
        console.error("Sign in error:", result.error);
        toast({ title: "Sign in failed", description: result.error.message, variant: "destructive", duration: 6000 });
      } else if ("deviceApprovalRequired" in result && result.deviceApprovalRequired) {
        saveEmailVerifyPending({ email: result.pendingEmail });
        toast({
          title: "Approve this browser next",
          description:
            "You’re signed in. On the next screen, tap “Email me a code” and enter the 6-digit approval we send to your inbox.",
          duration: 10000,
        });
        setPassword("");
        navigate("/auth/approve-device");
      } else if ("needsEmailVerification" in result && result.needsEmailVerification) {
        saveEmailVerifyPending({ email: result.pendingEmail });
        const reuseHint =
          "reuseVerificationCodeHint" in result && result.reuseVerificationCodeHint === true;
        toast({
          title: reuseHint ? "Use your existing verification code" : "Verify your email",
          description: reuseHint
            ? "We didn’t send a new email. Use the verification code from your original sign-up message and enter it on the next screen."
            : "We emailed an 8-digit code — enter it on the next screen to finish signing in.",
          duration: 9000,
        });
        setPassword("");
        navigate("/auth/verify-email");
      } else {
        posthogCapture("user_logged_in", { email });
        goToDashboardAfterAuth();
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - branding */}
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
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { value: "20", label: "Free Try-Ons" },
              { value: "<1s", label: "Try-On Speed" },
              { value: "99%", label: "Uptime" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-2xl font-bold text-primary-foreground">{stat.value}</p>
                <p className="text-xs text-primary-foreground/50 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 pt-8 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 lg:hidden">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 min-h-11 min-w-11 -ml-2 px-2 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 active:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
              Back to home
            </Link>
          </div>

          {businessSignupPaused ? (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">Sign up isn&apos;t open yet</h1>
              <p className="text-muted-foreground mb-4">
                New accounts are invite-only. Request access for your brand — when you&apos;re approved, we&apos;ll email you
                a link to create your TryVerse account.
              </p>
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-4 space-y-4 mb-6">
                <p className="text-sm text-foreground leading-relaxed">
                  <span className="font-medium">Next step:</span> start Sign Up and choose Business, or complete the interest form
                  at Early Access if you prefer.
                </p>
                <Button
                  type="button"
                  className="w-full gradient-primary text-primary-foreground h-12 shadow-soft"
                  onClick={() => openSignupChooser()}
                >
                  Sign Up
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button asChild variant="outline" className="w-full h-11">
                  <Link to={inviteOnly ? "/waitlist" : "/early-access"}>Early access form</Link>
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Already have an account?{" "}
                  <Link to="/auth" className="text-foreground font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          ) : individualSignupPaused ? (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">Personal sign-up is paused</h1>
              <p className="text-muted-foreground mb-6">
                We&apos;re not creating new individual accounts right now. Please check back later or{" "}
                <Link to="/auth" className="text-foreground font-medium underline underline-offset-2">
                  sign in
                </Link>{" "}
                if you already have one.
              </p>
            </>
          ) : (
            <>
          <h1
            className={`font-display text-2xl font-bold text-foreground ${showBusinessSignupForm ? "mb-2" : "mb-6"}`}
          >
            {showIndividualSignupForm
              ? "Create a personal account"
              : showBusinessSignupForm
                ? "Create your TryVerse account"
                : "Sign in or create an account"}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(showIndividualSignupForm || showBusinessSignupForm) && (
              <div className="space-y-2">
                <Label htmlFor="auth-account-type-locked">Account type</Label>
                <Select value={showIndividualSignupForm ? "individual" : "business"} disabled>
                  <SelectTrigger id="auth-account-type-locked" className="h-12 bg-muted/50 opacity-90">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {showIndividualSignupForm && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 h-12"
                  required
                  autoComplete="name"
                />
              </div>
            )}
            {showBusinessSignupForm && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Brand name"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="pl-10 h-12"
                    required
                  />
                </div>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Select value={role} onValueChange={setRole} required>
                    <SelectTrigger className="pl-10 h-12">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {role === "Other" && (
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter your role"
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                )}
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder={showIndividualSignupForm ? "Email" : "Work email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
                autoComplete="email"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 h-12"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  {showBusinessSignupForm || showIndividualSignupForm ? "Create account" : "Sign In"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {!showBusinessSignupForm && !showIndividualSignupForm && (
            <>
              <p className="text-sm text-muted-foreground text-center mt-4">
                <Link to="/forgot-password" className="text-foreground font-medium hover:underline">
                  Forgot your password?
                </Link>
              </p>
              {inviteOnly && (
                <p className="text-sm text-muted-foreground text-center mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 items-center">
                  <button
                    type="button"
                    className="text-foreground/80 font-medium hover:underline inline-block bg-transparent border-0 cursor-pointer p-0 font-[inherit]"
                    onClick={() => openSignupChooser()}
                  >
                    Sign Up →
                  </button>
                  <span className="text-border hidden sm:inline" aria-hidden>
                    |
                  </span>
                  <Link to="/book-demo" className="text-foreground/80 font-medium hover:underline inline-block">
                    Book a Demo →
                  </Link>
                </p>
              )}
            </>
          )}

          {(showBusinessSignupForm || showIndividualSignupForm) && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Already have an account?{" "}
              <Link to="/auth" className="text-foreground font-medium hover:underline">
                Sign in
              </Link>
            </p>
          )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
