import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Building2, Mail, Lock, User, Briefcase } from "lucide-react";
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
import { inviteSignupEnabled, b2cSignupEnabled } from "@/lib/featureFlags";
import { postLoginRedirectPath, safeInAppRedirectPath } from "@/lib/safeUrl";

const roles = [
  "Founder",
  "Developer",
  "Ecommerce Manager",
  "Marketing Manager",
  "Product Manager",
  "Other",
];

/** Supabase often surfaces raw SMTP/confirmation failures — copy varies by signup flow. */
function signUpErrorToast(
  error: Error,
  flow: "individual" | "business"
): {
  title: string;
  description: string;
  variant: "default" | "destructive";
} {
  const msg = (error.message || "").toLowerCase();
  const isEmailDeliveryIssue =
    msg.includes("confirmation email") ||
    msg.includes("sending confirmation") ||
    msg.includes("error sending") ||
    (msg.includes("email") && (msg.includes("could not") || msg.includes("failed to send") || msg.includes("smtp")));

  if (isEmailDeliveryIssue) {
    return {
      title: "Check your email settings",
      description:
        flow === "individual"
          ? "We couldn’t send the confirmation email. Check spam, wait a moment and try again, or sign in if you already verified. If it keeps failing, your project’s Supabase Auth email (SMTP) needs to be configured."
          : "We couldn’t send the confirmation email. If you were invited, try again or contact us. You can also request access via Join waitlist on the site.",
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
  const wantsBusinessInvite = hasBusinessInviteSignupParam(searchParams);
  /** Brand signup form — hidden when VITE_ENABLE_INVITE_SIGNUP=false */
  const showBusinessSignupForm = wantsBusinessInvite && inviteSignupEnabled;
  /** User opened business invite link while brand signups are paused — show waitlist message only */
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
        "Join the waitlist first. When we approve your brand, we’ll email you a link to create your TryVerse account.",
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
    } else {
      navigate(
        { pathname: resolved.pathname, search: resolved.search, hash: resolved.hash },
        { replace: true }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (showIndividualSignupForm) {
      const { error, session } = await signUp(
        email,
        password,
        fullName.trim() || "My Try-Ons",
        fullName,
        undefined,
        "individual"
      );
      if (error) {
        console.error("Signup error:", error);
        const t = signUpErrorToast(error, "individual");
        toast({ title: t.title, description: t.description, variant: t.variant, duration: 9000 });
      } else if (session) {
        posthogCapture("user_signed_up", { email, account_type: "individual", immediate_session: true });
        toast({
          title: "Welcome",
          description: "You're signed in — taking you to your dashboard.",
        });
        goToDashboardAfterAuth();
      } else {
        posthogCapture("user_signed_up", { email, account_type: "individual", immediate_session: false });
        toast({
          title: "Account created",
          description: "Confirm your email from the link we sent, then sign in here.",
        });
      }
    } else if (showBusinessSignupForm) {
      const finalRole = role === "Other" ? customRole : role;
      const { error, session } = await signUp(email, password, brandName, fullName, finalRole, "business");
      if (error) {
        console.error("Signup error:", error);
        const t = signUpErrorToast(error, "business");
        toast({ title: t.title, description: t.description, variant: t.variant, duration: 9000 });
      } else if (session) {
        posthogCapture("user_signed_up", { email, account_type: "business", immediate_session: true });
        toast({
          title: "Welcome",
          description: "You're signed in — taking you to your dashboard.",
        });
        goToDashboardAfterAuth();
      } else {
        posthogCapture("user_signed_up", { email, account_type: "business", immediate_session: false });
        toast({
          title: "Account created",
          description: "Confirm your email from the link we sent, then sign in here.",
        });
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        console.error("Sign in error:", error);
        toast({ title: "Sign in failed", description: error.message, variant: "destructive", duration: 6000 });
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
              <TryVerseLogo height={205} invert />
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
              { value: "3", label: "Free Try-Ons" },
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
                New accounts are invite-only. Right now we&apos;re only accepting brands through the waitlist — when yours is
                approved, we&apos;ll email you a link to create your account.
              </p>
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-4 space-y-4 mb-6">
                <p className="text-sm text-foreground leading-relaxed">
                  <span className="font-medium">Next step:</span> request access and tell us about your store. We&apos;ll
                  follow up and send a signup link when you&apos;re cleared.
                </p>
                <Button asChild className="w-full gradient-primary text-primary-foreground h-12 shadow-soft">
                  <Link to="/early-access">
                    Join the waitlist
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
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
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {showIndividualSignupForm
              ? "Create a personal account"
              : showBusinessSignupForm
                ? "Create your TryVerse account"
                : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mb-4">
            {showIndividualSignupForm
              ? "Upload your photo, try on clothes with AI, and download your favorites."
              : showBusinessSignupForm
                ? "For invited brands only — use the email we approved for your workspace."
                : "Sign in to continue."}
          </p>

          {showBusinessSignupForm && (
            <>
              <p className="text-sm mb-4">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                  Choose individual or business instead
                </Link>
              </p>
              <p className="text-sm text-muted-foreground mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 leading-relaxed">
                <span className="font-medium text-foreground">Not invited yet?</span> Anyone can request to join via{" "}
                <Link to="/early-access" className="text-foreground font-medium underline underline-offset-2 hover:no-underline">
                  Join waitlist
                </Link>
                . We only enable sign-up for brands we&apos;ve invited.
              </p>
            </>
          )}

          {showIndividualSignupForm && (
            <>
              <p className="text-sm mb-4">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-medium"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" />
                  Choose individual or business instead
                </Link>
              </p>
              <p className="text-sm text-muted-foreground mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 leading-relaxed">
                <span className="font-medium text-foreground">Just for you.</span> This account is for personal try-ons — no store or
                API setup. Running a brand?{" "}
                <Link to="/auth?signup=business" className="text-foreground font-medium underline underline-offset-2 hover:no-underline">
                  Continue as a business
                </Link>
                .
              </p>
            </>
          )}

          {!showBusinessSignupForm && !showIndividualSignupForm && (
            <>
              <p className="text-sm text-muted-foreground mb-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 leading-relaxed">
                <span className="font-medium text-foreground">New to TryVerse?</span> Choose how you&apos;ll use it:
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mb-6">
                <Button asChild variant="default" className="flex-1 h-11 gap-2 gradient-primary text-primary-foreground shadow-soft">
                  <Link to="/auth?signup=individual">
                    <User className="h-4 w-4" />
                    Sign up — Individual
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 h-11 gap-2">
                  <Link to="/auth?signup=business">
                    <Building2 className="h-4 w-4" />
                    Continue as Business
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-6">
                Brands on the waitlist: after you&apos;re approved, use the{" "}
                <Link to="/auth?signup=business" className="text-foreground font-medium underline underline-offset-2">
                  business
                </Link>{" "}
                link with your work email.
                {!inviteSignupEnabled && (
                  <span className="block mt-2">Business self-serve signup may be paused until your invite is enabled.</span>
                )}
              </p>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="Company name"
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

            <Button type="submit" className="w-full gradient-primary text-primary-foreground h-12 shadow-soft" disabled={loading}>
              {loading
                ? "Please wait..."
                : showBusinessSignupForm || showIndividualSignupForm
                  ? "Create account"
                  : "Sign In"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {!showBusinessSignupForm && !showIndividualSignupForm && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              <Link to="/forgot-password" className="text-foreground font-medium hover:underline">
                Forgot your password?
              </Link>
            </p>
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
