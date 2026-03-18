import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Building2, Mail, Lock, User, Briefcase } from "lucide-react";
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

const roles = [
  "Founder",
  "Developer",
  "Ecommerce Manager",
  "Marketing Manager",
  "Product Manager",
  "Other",
];

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
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Account created!", description: "Check your email to confirm your account." });
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
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
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {isSignUp ? "Start your free account" : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isSignUp ? "Get 3 free AI try-ons to test our platform" : "Sign in to your brand dashboard"}
          </p>

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
