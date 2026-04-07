import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";

const ForgotPassword = () => {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const origin = window.location.origin;
      await signIn("password", {
        flow: "reset",
        email: email.trim(),
        redirectTo: `${origin}/reset-password`,
      } as Record<string, unknown>);
      toast({
        title: "Check your email",
        description: "We sent an 8-digit code. Enter it on the next screen with your new password.",
      });
      navigate("/reset-password", { state: { email: email.trim() }, replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="font-display text-xl font-bold text-foreground mb-8 block">
          TryVerse<span className="text-muted-foreground">.AI</span>
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Forgot your password?</h1>
        <p className="text-muted-foreground mb-8">
          Enter your email and we&apos;ll send an 8-digit code to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
          <Button type="submit" className="w-full gradient-primary text-primary-foreground h-12 shadow-soft" disabled={loading}>
            {loading ? "Sending..." : "Send code"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          <Link to="/auth" className="inline-flex items-center gap-1 text-foreground font-medium hover:underline">
            <ArrowLeft className="h-3 w-3" /> Back to Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
