import { useState, useEffect } from "react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "tryverse_cookie_consent";
const RESET_EVENT = "tryverse-reset-cookie-consent";

type ConsentState = "all" | "essential" | null;

export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentState>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "all" || stored === "essential" ? (stored as ConsentState) : null;
  });

  useEffect(() => {
    const handleReset = () => {
      localStorage.removeItem(STORAGE_KEY);
      setConsent(null);
    };
    window.addEventListener(RESET_EVENT, handleReset);
    return () => window.removeEventListener(RESET_EVENT, handleReset);
  }, []);

  const saveAndClose = (value: ConsentState) => {
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
      setConsent(value);
    }
  };

  const handleAcceptAll = () => saveAndClose("all");
  const handleRejectAll = () => saveAndClose("essential");

  if (consent !== null) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-card border border-border rounded-xl shadow-lg p-6 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Cookie className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">Cookies</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              We use cookies to improve your experience and analyze site usage. You can manage your preferences anytime.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button size="sm" onClick={handleAcceptAll} className="gradient-primary text-primary-foreground">
            Accept All
          </Button>
          <Button size="sm" variant="outline" onClick={handleRejectAll}>
            Reject All
          </Button>
        </div>
      </div>
    </div>
  );
}
