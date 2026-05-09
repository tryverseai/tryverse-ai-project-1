import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { useToast } from "@/hooks/use-toast";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("email", trimmed);
      fd.set("flow", "reset");
      await signIn("password", fd);
      toast({
        title: "Check your email",
        description:
          "If an account exists for that address, you’ll receive a code shortly. Enter it on the next screen with your new password.",
        duration: 9000,
      });
      navigate("/reset-password", { state: { email: trimmed } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
      toast({
        title: "Could not start reset",
        description: msg,
        variant: "destructive",
        duration: 9000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-block mb-8">
          <TryVerseLogo height={120} />
        </Link>
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to sign in
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Reset your password</h1>
        <p className="text-muted-foreground mb-6 leading-relaxed text-sm">
          Enter the email for your TryVerse account. We&apos;ll send a one-time verification code so you can choose a
          new password.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fp-email">Email</Label>
            <Input
              id="fp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="you@company.com"
              required
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            className="w-full gradient-primary text-primary-foreground h-12 shadow-soft"
            disabled={loading}
          >
            {loading ? "Sending…" : "Send verification code"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Remember your password?{" "}
          <Link to="/auth" className="text-foreground font-medium hover:underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
