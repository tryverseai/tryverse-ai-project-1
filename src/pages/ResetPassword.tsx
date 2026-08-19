import { useState, type FormEvent, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { convexAuthEmailFlowToast } from "@/lib/convexAuthEmailFlowToast";

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const rawState = location.state as { email?: unknown } | null;
  const email = typeof rawState?.email === "string" ? rawState.email.trim().toLowerCase() : "";
  const { signIn } = useAuthActions();
  const { syncBackendSession } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate("/forgot-password", { replace: true });
    }
  }, [email, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const c = code.trim().replace(/\s+/g, "");
    if (!c) {
      toast({ title: "Code required", description: "Enter the 8-digit code from your email.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Your new password needs at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("code", c);
      fd.set("newPassword", newPassword);
      fd.set("flow", "reset-verification");
      const result = await signIn("password", fd);
      if (!result.signingIn) {
        toast({
          title: "That code didn’t work",
          description: "It may be incorrect or expired. Request a new code from the forgot password page.",
          variant: "destructive",
          duration: 9000,
        });
        return;
      }
      const synced = await syncBackendSession({ email });
      if (synced.error) {
        toast({
          title: "Signed in, but setup didn’t finish",
          description: synced.error.message,
          variant: "destructive",
          duration: 9000,
        });
        return;
      }
      toast({
        title: "Password updated",
        description: "You’re signed in. Redirecting…",
        duration: 6000,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const friendly = convexAuthEmailFlowToast(err, "reset_verify");
      toast({
        title: friendly?.title ?? "Could not reset password",
        description:
          friendly?.description ??
          "That code didn’t work — it may be incorrect or expired. Request a new one and try again.",
        variant: friendly?.variant ?? "destructive",
        duration: 9000,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-block mb-8">
          <TryVerseLogo height={44} />
        </Link>
        <Link
          to="/forgot-password"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          Request a new code
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Enter code &amp; new password</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Email: <span className="text-foreground font-medium">{email}</span>
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp-code">Verification code</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(ev) => setCode(ev.target.value)}
              placeholder="8-digit code from email"
              className="h-12 tracking-widest"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-new">New password</Label>
            <Input
              id="rp-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="h-12"
            />
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
                Updating…
              </>
            ) : (
              "Update password and sign in"
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
