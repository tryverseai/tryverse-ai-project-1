import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeEmail } from "@/lib/backendApi";

export default function AuthConfirm() {
  const navigate = useNavigate();
  const { user, session, loading } = useAuth();
  const [status, setStatus] = useState<"confirming" | "success" | "invalid">("confirming");
  const welcomeSentRef = useRef(false);

  useEffect(() => {
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const hasAuthParams = hash.includes("access_token") || hash.includes("type=signup") || hash.includes("type=recovery");
    const code = searchParams.get("code");

    const finish = (result: "success" | "invalid") => {
      setStatus(result);
      window.history.replaceState({}, document.title, window.location.pathname);
    };

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        finish(error ? "invalid" : "success");
      });
      return;
    }

    if (hasAuthParams) {
      // Supabase auto-processes hash; session will update via onAuthStateChange
      finish("success");
      return;
    }

    if (!loading) {
      if (session?.user?.email_confirmed_at) {
        setStatus("success");
      } else {
        setStatus("invalid");
      }
    }
  }, [session, loading]);

  // Send Resend welcome email when user confirms (only once)
  useEffect(() => {
    if (status === "success" && user?.email && !welcomeSentRef.current) {
      welcomeSentRef.current = true;
      const meta = user.user_metadata as { full_name?: string; brand_name?: string } | undefined;
      sendWelcomeEmail({
        name: meta?.full_name,
        brandName: meta?.brand_name,
      }).catch((err) => {
        console.warn("Failed to send welcome email:", err);
      });
    }
  }, [status, user]);

  useEffect(() => {
    if (status === "success" && user) {
      const t = setTimeout(() => navigate("/dashboard", { replace: true }), 3000);
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
          <p className="text-muted-foreground mb-6">This link is invalid or has already been used.</p>
          <Link to="/auth">
            <Button>Go to Sign In</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left - branding (matches Auth page) */}
      <div className="hidden lg:flex lg:w-1/2 bg-black items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 max-w-md text-center">
          <Link to="/" className="inline-block mb-8">
            <TryVerseLogo height={180} invert />
          </Link>
          <h2 className="font-display text-3xl font-bold text-primary-foreground mb-4 leading-tight">
            Welcome to TryVerse
          </h2>
          <p className="text-primary-foreground/60 text-lg">
            Your account is verified. You're ready to transform your fashion commerce.
          </p>
        </div>
      </div>

      {/* Right - confirmation UI */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md text-center"
        >
          {status === "confirming" ? (
            <>
              <div className="w-16 h-16 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin mx-auto mb-6" />
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">Confirming your email…</h1>
              <p className="text-muted-foreground">Please wait a moment.</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">Email confirmed</h1>
              <p className="text-muted-foreground mb-8">
                Your account is ready. Redirecting you to your dashboard…
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/dashboard">
                    Open Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/">Back to Home</Link>
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Mobile: show logo at top */}
      <div className="lg:hidden absolute top-6 left-0 right-0 flex justify-center">
        <Link to="/">
          <TryVerseLogo height={48} />
        </Link>
      </div>
    </div>
  );
}
