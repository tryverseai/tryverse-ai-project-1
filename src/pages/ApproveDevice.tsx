import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TryVerseLogo } from "@/components/TryVerseLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreateDeviceFingerprint } from "@/lib/deviceFingerprint";
import { requestAccountDeviceApprovalCode, verifyAccountDeviceApproval } from "@/lib/backendApi";
import { postLoginRedirectPath } from "@/lib/safeUrl";

/**
 * Returning users signing in from a browser that Convex / the API has never marked as trusted
 * complete this step once (no impact on sessions on other browsers).
 */
export default function ApproveDevice() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut, syncBackendSession } = useAuth();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"idle" | "send" | "verify">("idle");

  const email = user?.email?.trim().toLowerCase() ?? "";

  const goDashboard = () => {
    const path = postLoginRedirectPath(sessionStorage.getItem("tryverse_redirect") || "/dashboard");
    navigate(path, { replace: true });
  };

  const onRequestCode = async () => {
    if (!email) return;
    const fp = getOrCreateDeviceFingerprint();
    if (fp.length < 8) {
      toast({
        title: "Could not identify this browser",
        description: "Enable local storage or try another browser.",
        variant: "destructive",
      });
      return;
    }
    setBusy("send");
    try {
      await requestAccountDeviceApprovalCode({
        deviceFingerprint: fp,
      });
      toast({
        title: "Check your inbox",
        description: `We emailed a 6-digit code to ${email}. Codes expire in 10 minutes.`,
        duration: 10000,
      });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not send a device code — try signing in again in a minute.";
      toast({ title: "Could not send code", description: msg, variant: "destructive", duration: 9000 });
    } finally {
      setBusy("idle");
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().replace(/\s+/g, "");
    if (!/^[0-9]{6}$/.test(trimmed)) {
      toast({ title: "Invalid code", description: "Enter the 6-digit code from your email.", variant: "destructive" });
      return;
    }
    if (!email) return;

    const fp = getOrCreateDeviceFingerprint();
    if (fp.length < 8) {
      toast({ title: "Browser issue", description: "Reload the page and try again.", variant: "destructive" });
      return;
    }

    setBusy("verify");
    try {
      await verifyAccountDeviceApproval({
        deviceFingerprint: fp,
        code: trimmed,
      });
      const synced = await syncBackendSession({ email });
      if (synced.deviceApprovalRequired) {
        toast({
          title: "Still pending approval",
          description: "Tap “Email me a code” once more—your previous approval may still be syncing.",
          variant: "destructive",
          duration: 9000,
        });
        return;
      }
      if (synced.error) {
        toast({
          title: "Setup incomplete",
          description: synced.error.message,
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      toast({ title: "Device approved", description: "Continuing to your dashboard…", duration: 4000 });
      goDashboard();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid or expired code.";
      toast({ title: "Verification failed", description: msg, variant: "destructive", duration: 9000 });
    } finally {
      setBusy("idle");
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
          <TryVerseLogo height={110} />
        </Link>

        {!user ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Sign in first, then open this screen from TryVerse.</p>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/auth">Go to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Approve this browser</h1>
            <p className="text-muted-foreground text-sm mb-6">
              For verified accounts signing in here for the first time, we confirm it&apos;s you with a{" "}
              <strong className="text-foreground font-medium">short email code</strong>. Other browsers stay signed in —
              nothing is logged out remotely.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Account: <span className="font-medium text-foreground">{email}</span>
            </p>

            <div className="space-y-3 mb-8">
              <Button
                type="button"
                variant="secondary"
                className="w-full h-11"
                disabled={busy !== "idle"}
                aria-busy={busy === "send"}
                onClick={() => void onRequestCode()}
              >
                {busy === "send" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  "Email me a 6-digit code"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Opens your inbox ({email}); code expires in 10 minutes.
              </p>
            </div>

            <form onSubmit={(ev) => void onVerify(ev)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="device-code">6-digit approval code</Label>
                <Input
                  id="device-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="######"
                  maxLength={6}
                  value={code}
                  onChange={(ev) => setCode(ev.target.value)}
                  className="h-12 tracking-widest font-mono"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 gradient-primary text-primary-foreground shadow-soft"
                disabled={busy !== "idle"}
                aria-busy={busy === "verify"}
              >
                {busy === "verify" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Verifying…
                  </>
                ) : (
                  "Approve and continue"
                )}
              </Button>

              <div className="flex flex-wrap justify-center gap-3 pt-2 text-xs text-muted-foreground">
                <Button type="button" variant="link" size="sm" className="h-auto p-0 underline" asChild>
                  <Link to="/dashboard">Back to dashboard</Link>
                </Button>
                <span aria-hidden>|</span>
                <button type="button" className="underline hover:text-foreground" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
