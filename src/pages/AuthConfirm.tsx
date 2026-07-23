import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { useAuth } from "@/contexts/AuthContext";

/** Legacy route kept for bookmarks; Convex Auth confirms in-app. Welcome email is handled by server bootstrap. */
export default function AuthConfirm() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"confirming" | "success" | "invalid">("confirming");

  useEffect(() => {
    if (loading) return;
    setStatus(user ? "success" : "invalid");
  }, [loading, user]);

  useEffect(() => {
    if (status === "success" && user) {
      const t = setTimeout(() => navigate("/dashboard", { replace: true }), 2500);
      return () => clearTimeout(t);
    }
  }, [status, user, navigate]);

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Link to="/" className="mb-8">
          <TryVerseLogo height={64} />
        </Link>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <p className="text-lg font-semibold text-foreground mb-2">Sign in required</p>
          <p className="text-sm text-muted-foreground mb-6">
            Open TryVerse and sign in from the auth page, or request a new link if you were verifying email.
          </p>
          <Button asChild>
            <Link to="/auth">Back to sign in</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Link to="/" className="mb-8">
        <TryVerseLogo height={64} />
      </Link>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <CheckCircle2 className="h-14 w-14 text-foreground mx-auto mb-4" aria-hidden />
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">You&apos;re in</h1>
        <p className="text-sm text-muted-foreground mb-8">Redirecting to your dashboard…</p>
        <Button asChild className="gap-2">
          <Link to="/dashboard">
            Continue <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
