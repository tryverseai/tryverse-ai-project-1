import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceOnboardingModal } from "./ComplianceOnboardingModal";
import type { PolicyAudience } from "@/content/policyContent";

/**
 * Shows compliance onboarding modal for logged-in users who haven't
 * yet acknowledged Terms, Privacy, and Data Processing.
 */
export function ComplianceOnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [policyAudience, setPolicyAudience] = useState<PolicyAudience>("business");

  useEffect(() => {
    if (!user) {
      setShowModal(false);
      setLoading(false);
      return;
    }

    const checkCompliance = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("compliance_onboarding_completed_at, account_type")
          .eq("id", user.id)
          .maybeSingle();

        const row = data;
        if (row?.account_type === "individual" || user.user_metadata?.account_type === "individual") {
          setPolicyAudience("individual");
        } else {
          setPolicyAudience("business");
        }

        if (error || !row) {
          setShowModal(true);
          return;
        }

        setShowModal(!row.compliance_onboarding_completed_at);
      } catch {
        setShowModal(false);
      } finally {
        setLoading(false);
      }
    };

    checkCompliance();
  }, [user?.id, user?.user_metadata]);

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
