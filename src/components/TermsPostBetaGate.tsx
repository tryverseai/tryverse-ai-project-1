import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TryVersePrivacyPolicy } from "@/content/TryVersePrivacyPolicy";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TryVerseLogo } from "@/components/TryVerseLogo";

/**
 * Full-screen acceptance after beta approval — blocks dashboard until the user agrees to Terms & Privacy.
 */
export function TermsPostBetaGate() {
  const accept = useMutation(api.profiles.acceptTermsOfService);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContinue = async () => {
    if (!agreed || saving) return;
    setError(null);
    setSaving(true);
    try {
      await accept({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="shrink-0 border-b border-border bg-card/95 px-4 py-6 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
          <Link to="/" className="inline-block shrink-0">
            <TryVerseLogo height={52} />
          </Link>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Terms of Service &amp; Privacy Policy
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Please review and accept to continue to your dashboard.
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <TryVersePrivacyPolicy className="pb-16" />

          <div className="sticky bottom-0 left-0 right-0 border-t border-border bg-background/95 px-4 py-6 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto flex w-full max-w-xl flex-col items-center">
              <label className="flex w-full cursor-pointer items-start gap-3 text-left text-sm leading-snug">
                <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5 shrink-0" />
                <span>
                  I have read and agree to the{" "}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {error && <p className="mt-3 w-full text-center text-sm text-destructive">{error}</p>}
              <Button
                type="button"
                disabled={!agreed || saving}
                className="mt-6 w-full max-w-xs gradient-primary font-semibold"
                size="lg"
                onClick={() => void onContinue()}
              >
                {saving ? "Saving…" : "Continue to dashboard"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
