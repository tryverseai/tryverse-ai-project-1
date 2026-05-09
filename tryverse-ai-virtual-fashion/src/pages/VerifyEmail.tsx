import { useState, useMemo, type FormEvent, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { turnstileSiteKey } from "@/lib/turnstileEnv";
import {
  clearEmailVerifyPending,
  readEmailVerifyPending,
  type EmailVerifyPendingPayload,
} from "@/lib/emailVerifyPendingStorage";
import { postLoginRedirectPath } from "@/lib/safeUrl";
import { completeInviteAfterSignup } from "@/lib/backendApi";
import { dashboardPathForAccountType, type AccountType } from "@/lib/accountType";
import { posthogCapture } from "@/lib/posthog";

const TURNSTILE_SITE_KEY = turnstileSiteKey();

/** After verification: same routing rules as `Auth.tsx` dashboard redirect */
function navigateAfterAuthenticated(
  navigate: ReturnType<typeof useNavigate>,
  searchParams: URLSearchParams
) {
  const redirectParam = searchParams.get("redirect");
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
  if (
    pathOnly === "/dashboard" ||
    pathOnly.startsWith("/dashboard/business") ||
    pathOnly.startsWith("/dashboard/individual")
  ) {
    navigate({ pathname: "/dashboard", search: resolved.search, hash: resolved.hash }, { replace: true });
    return;
  }
  navigate(
    { pathname: resolved.pathname, search: resolved.search, hash: resolved.hash },
    { replace: true }
  );
}

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmailWithCode } = useAuth();
  const { toast } = useToast();

  const payloadFromStorage = useMemo(() => readEmailVerifyPending(), []);
  const emailFromQuery = useMemo(() => {
    const q = searchParams.get("email");
    return q ? q.trim().toLowerCase() : "";
  }, [searchParams]);

  const payload = useMemo((): EmailVerifyPendingPayload | null => {
    if (payloadFromStorage?.email) return payloadFromStorage;
    if (emailFromQuery) return { email: emailFromQuery };
    return null;
  }, [payloadFromStorage, emailFromQuery]);

  const [code, setCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!payload?.email) {
      navigate("/auth", { replace: true });
    }
  }, [payload, navigate]);

  if (!payload?.email) {
    return null;
  }

  const emailDisplay = payload.email;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().replace(/\s+/g, "");
    if (!c) {
      toast({
        title: "Code required",
        description: "Enter the 8-digit code from your email.",
        variant: "destructive",
      });
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken.trim()) {
      toast({
        title: "Security verification required",
        description: "Complete the security check below, then try again.",
        variant: "destructive",
      });
      return;
    }
    const ts = turnstileToken.trim() || undefined;
    setLoading(true);
    try {
      const verified = await verifyEmailWithCode(payload.email, c, {
        turnstileToken: ts,
        pendingBootstrap: payload.pendingBootstrap,
      });
      if (verified.error) {
        toast({
          title: "Could not verify email",
          description: verified.error.message,
          variant: "destructive",
          duration: 9000,
        });
        return;
      }
      clearEmailVerifyPending();
      posthogCapture("email_verification_completed", { email: payload.email });

      if (payload.inviteToken?.trim()) {
        const acct: AccountType = payload.accountTypeAfterInvite ?? "individual";
        try {
          await completeInviteAfterSignup(payload.inviteToken.trim(), payload.email);
        } catch (err) {
          toast({
            title: "You’re verified",
            description:
              err instanceof Error
                ? `${err.message} If setup doesn’t finish, contact info@tryverseai.com.`
                : "We couldn’t finalize the invitation. Contact info@tryverseai.com if this persists.",
            variant: "default",
            duration: 9000,
          });
        }
        toast({ title: "Welcome!", description: "Your account is ready.", duration: 6000 });
        sessionStorage.removeItem("tryverse_redirect");
        navigate(dashboardPathForAccountType(acct), { replace: true });
        return;
      }

      toast({ title: "Email verified", description: "You’re signed in. Redirecting…", duration: 5000 });
      navigateAfterAuthenticated(navigate, searchParams);
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
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Verify your email</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          We sent a welcome email with an 8-digit code to{" "}
          <span className="text-foreground font-medium break-all">{emailDisplay}</span>. Enter it below to verify and
          continue.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-verify-code">Verification code</Label>
            <Input
              id="email-verify-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(ev) => setCode(ev.target.value)}
              placeholder="8-digit code"
              className="h-12 tracking-widest"
              required
            />
          </div>
          {TURNSTILE_SITE_KEY ? (
            <div className="flex min-h-[72px] w-full justify-center py-2">
              <Turnstile
                siteKey={TURNSTILE_SITE_KEY}
                options={{ appearance: "always", size: "normal" }}
                onSuccess={(t) => setTurnstileToken(t)}
                onExpire={() => setTurnstileToken("")}
                onError={() => setTurnstileToken("")}
              />
            </div>
          ) : import.meta.env.DEV ? (
            <p className="text-xs text-amber-600 dark:text-amber-500 text-center">
              Turnstile: set <code className="rounded bg-muted px-1">VITE_CLOUDFLARE_TURNSTILE_SITE_KEY</code> in .env for
              production parity.
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full gradient-primary text-primary-foreground h-12 shadow-soft"
            disabled={loading}
          >
            {loading ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
