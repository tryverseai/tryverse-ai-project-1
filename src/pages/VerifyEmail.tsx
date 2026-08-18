import { useState, useMemo, type FormEvent, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearEmailVerifyPending,
  readEmailVerifyPending,
  saveEmailVerifyPending,
  type EmailVerifyPendingPayload,
} from "@/lib/emailVerifyPendingStorage";
import { postLoginRedirectPath } from "@/lib/safeUrl";
import { completeInviteAfterSignup } from "@/lib/backendApi";
import { dashboardPathForAccountType, type AccountType } from "@/lib/accountType";
import { posthogCapture } from "@/lib/posthog";
import { convexAuthEmailFlowToast } from "@/lib/convexAuthEmailFlowToast";

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
  const [loading, setLoading] = useState(false);
  const [codeFailed, setCodeFailed] = useState(false);

  useEffect(() => {
    if (!payload?.email) {
      navigate("/auth", { replace: true });
    }
  }, [payload, navigate]);

  if (!payload?.email) {
    return null;
  }

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
    setLoading(true);
    try {
      const verified = await verifyEmailWithCode(payload.email, c, {
        pendingBootstrap: payload.pendingBootstrap,
      });
      if (verified.error) {
        const friendly = convexAuthEmailFlowToast(verified.error, "email_verify");
        toast({
          title: friendly?.title ?? "Could not verify email",
          description: friendly?.description ?? verified.error.message,
          variant: friendly?.variant ?? "destructive",
          duration: 9000,
        });
        setCodeFailed(true);
        return;
      }
      if (verified.deviceApprovalRequired) {
        saveEmailVerifyPending({ email: payload.email });
        toast({
          title: "Approve this browser next",
          description:
            "You’re verified. On the next screen, tap “Email me a code” and enter the 6-digit approval email for this browser.",
          duration: 10000,
        });
        navigate("/auth/approve-device", { replace: true });
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
          <TryVerseLogo height={48} />
        </Link>
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to sign in
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Verify your email</h1>
        <p className="text-muted-foreground mb-6 text-sm">Enter the 8-digit verification code.</p>
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
          <Button
            type="submit"
            className="w-full gradient-primary text-primary-foreground h-12 shadow-soft"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Verifying…
              </>
            ) : (
              "Verify and continue"
            )}
          </Button>
        </form>
        {codeFailed && (
          <p className="text-sm text-muted-foreground text-center mt-6">
            Code expired or not working? Head back and sign up again with the same email and password — we&apos;ll
            send a fresh code.{" "}
            <Link to="/auth" className="text-foreground font-medium hover:underline">
              Back to sign up
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
