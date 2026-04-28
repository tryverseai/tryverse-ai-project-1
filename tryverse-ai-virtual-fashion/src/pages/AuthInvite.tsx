import { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, Eye, EyeOff, Building2, Mail, Lock, User, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { posthogCapture } from "@/lib/posthog";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { postLoginRedirectPath, safeInAppRedirectPath } from "@/lib/safeUrl";
import { readLocalSession } from "@/lib/localSession";
import { validateInviteToken } from "@/lib/backendApi";

const roles = [
  "Founder",
  "Developer",
  "Ecommerce Manager",
  "Marketing Manager",
  "Product Manager",
  "Other",
];

function signUpErrorToast(error: Error): {
  title: string;
  description: string;
  variant: "default" | "destructive";
} {
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

const AuthInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchChecked, setSearchChecked] = useState(false);
  const [gateLoading, setGateLoading] = useState(true);
  const [gateValid, setGateValid] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [brandName, setBrandName] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { toast } = useToast();

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
        setGateLoading(false);
        return;
      }
      setGateLoading(true);
      try {
        const { valid, email: em } = await validateInviteToken(token.trim());
        if (cancelled) return;
        setGateValid(valid);
        if (valid && em) {
          setInviteEmail(em);
          setEmail(em);
        }
      } catch {
        if (!cancelled) setGateValid(false);
      } finally {
        if (!cancelled) setGateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchChecked, token]);

  const goToDashboardAfterAuth = () => {
    const rp = searchParams.get("redirect");
    if (rp) sessionStorage.removeItem("tryverse_redirect");
    const nextPath = postLoginRedirectPath(
      rp || sessionStorage.getItem("tryverse_redirect") || "/dashboard"
    );
    const resolved = new URL(nextPath, window.location.origin);
    if (resolved.origin !== window.location.origin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    const pathOnly = resolved.pathname;
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

  const finishAuthIfSessionReady = async (): Promise<boolean> => {
    const intervalMs = 150;
    const maxWaitMs = 6000;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (readLocalSession()) return true;
      await new Promise<void>((r) => setTimeout(r, intervalMs));
    }
    return Boolean(readLocalSession());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gateValid) return;
    setLoading(true);
    const finalRole = role === "Other" ? customRole : role;
    const { error } = await signUp(email, password, brandName, fullName, finalRole, "business");
    if (error) {
      console.error("Signup error:", error);
      const t = signUpErrorToast(error);
      toast({ title: t.title, description: t.description, variant: t.variant, duration: 9000 });
    } else {
      const hasSession = await finishAuthIfSessionReady();
      if (!hasSession) {
        toast({
          title: "Could not finish sign-in",
          description: "Try again in a moment or refresh the page. If it keeps happening, contact support.",
          variant: "destructive",
          duration: 8000,
        });
      } else {
        posthogCapture("user_signed_up", { email, account_type: "business" });
        toast({ title: "Welcome!", description: "Your account is ready.", duration: 6000 });
        setPassword("");
        goToDashboardAfterAuth();
      }
    }
    setLoading(false);
  };

  if (!FEATURE_FLAGS.INVITE_ONLY_MODE) return null;

  return (
    <div className="min-h-screen bg-background flex">
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
              <h1 className="font-display text-2xl font-bold text-foreground">Invitation required</h1>
              <p className="text-muted-foreground leading-relaxed">
                Access is currently invitation-only. Join the waitlist to request early access.
              </p>
              <Button asChild className="w-full gradient-primary text-primary-foreground h-12 shadow-soft">
                <Link to="/waitlist">
                  Join Waitlist
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
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">Create your TryVerse account</h1>
              <p className="text-muted-foreground mb-6">
                Complete setup with the email on your invitation ({inviteEmail}).
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
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
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Work email"
                    value={email}
                    className="pl-10 h-12"
                    required
                    autoComplete="email"
                    readOnly
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
                  {loading ? "Please wait..." : "Create account"}
                  <ArrowRight className="ml-2 h-4 w-4" />
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
