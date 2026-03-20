import { useState, useEffect } from "react";
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

const roles = [
  "Founder",
  "Developer",
  "Ecommerce Manager",
  "Marketing Manager",
  "Product Manager",
  "Other",
];

/** Supabase often surfaces raw SMTP/confirmation failures — steer users to Early Access / waitlist. */
function signUpErrorToast(error: Error): {
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
      title: "Early access only for now",
      description:
        "We're onboarding through the waitlist first. Use Get Early Access on the site to join; full self-serve sign-up will open once we're ready.",
      variant: "default",
    };
  }

  return {
    title: "Sign up failed",
    description: error.message,
    variant: "destructive",
  };
}

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("signup") === "true");
  const redirectParam = searchParams.get("redirect");
  const redirectTo = redirectParam || sessionStorage.getItem("tryverse_redirect") || "/dashboard";
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
    if (searchParams.get("signup") === "true") setIsSignUp(true);
  }, [searchParams]);

  useEffect(() => {
    if (redirectParam) sessionStorage.setItem("tryverse_redirect", redirectParam);
  }, [redirectParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      const finalRole = role === "Other" ? customRole : role;
      const { error } = await signUp(email, password, brandName, fullName, finalRole);
      if (error) {
        console.error("Signup error:", error);
        const t = signUpErrorToast(error);
        toast({ title: t.title, description: t.description, variant: t.variant, duration: 9000 });
      } else {
        posthogCapture("user_signed_up", { email });
        toast({ title: "Account created!", description: "Check your email to confirm your account." });
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        console.error("Sign in error:", error);
        toast({ title: "Sign in failed", description: error.message, variant: "destructive", duration: 6000 });
      } else {
        posthogCapture("user_logged_in", { email });
        if (redirectParam) sessionStorage.removeItem("tryverse_redirect");
        navigate(redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`, { replace: true });
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

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {isSignUp ? "Start your free account" : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mb-4">
            {isSignUp ? "Get 3 free AI try-ons to test our platform" : "Sign in to your brand dashboard"}
          </p>

          {isSignUp && (
            <p className="text-sm text-muted-foreground mb-6 rounded-lg border border-border bg-muted/40 px-4 py-3 leading-relaxed">
              <span className="font-medium text-foreground">Prefer to join first?</span> We&apos;re onboarding via{" "}
              <Link to="/early-access" className="text-foreground font-medium underline underline-offset-2 hover:no-underline">
                Early Access / waitlist
              </Link>
              . Full self-serve sign-up may be limited while we scale email delivery.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
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
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
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
              {loading ? "Please wait..." : isSignUp ? "Start Free" : "Sign In"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {!isSignUp && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              <Link to="/forgot-password" className="text-foreground font-medium hover:underline">
                Forgot your password?
              </Link>
            </p>
          )}

          <p className="text-sm text-muted-foreground text-center mt-4">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-foreground font-medium hover:underline"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
