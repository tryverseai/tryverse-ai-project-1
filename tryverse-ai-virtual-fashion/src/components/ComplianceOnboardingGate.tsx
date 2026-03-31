import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceOnboardingModal } from "./ComplianceOnboardingModal";
import type { PolicyAudience } from "@/content/policyContent";
import { complianceDoneSessionKey } from "@/lib/complianceStorage";
import { getStoredAdminKey } from "@/lib/backendApi";

/**
 * Shows compliance onboarding modal for logged-in users who haven't
 * yet acknowledged Terms, Privacy, and Data Processing.
 */
export function ComplianceOnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [policyAudience, setPolicyAudience] = useState<PolicyAudience>("business");
  const skipCompliance =
    location.pathname.startsWith("/admin") ||
    (typeof window !== "undefined" && !!getStoredAdminKey());

  useEffect(() => {
    if (!user) {
      setShowModal(false);
      setLoading(false);
      return;
    }

    if (skipCompliance) {
      setShowModal(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const sessionFlag = sessionStorage.getItem(complianceDoneSessionKey(user.id)) === "1";

    const checkCompliance = async () => {
      const metaAudience: PolicyAudience =
        user.user_metadata?.account_type === "individual" ? "individual" : "business";

      try {
        if (sessionFlag && !cancelled) {
          setShowModal(false);
        }

        const { data: row, error } = await supabase
          .from("profiles")
          .select("compliance_onboarding_completed_at, account_type")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        const audience: PolicyAudience =
          row?.account_type === "individual" || row?.account_type === "business"
            ? row.account_type
            : metaAudience;

        setPolicyAudience(audience);

        if (error) {
          console.error("Compliance profile load failed:", error);
          setShowModal(false);
          return;
        }

        if (!row) {
          setShowModal(true);
          sessionStorage.removeItem(complianceDoneSessionKey(user.id));
          return;
        }

        if (row.compliance_onboarding_completed_at) {
          sessionStorage.setItem(complianceDoneSessionKey(user.id), "1");
          setShowModal(false);
        } else {
          sessionStorage.removeItem(complianceDoneSessionKey(user.id));
          setShowModal(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setShowModal(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void checkCompliance();

    return () => {
      cancelled = true;
    };
  }, [user?.id, skipCompliance, user?.user_metadata?.account_type]);

  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <ComplianceOnboardingModal
        open={showModal}
        userId={user.id}
        accountType={policyAudience}
        onComplete={() => setShowModal(false)}
        onExit={() => setShowModal(false)}
      />
    </>
  );
}
