import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ComplianceOnboardingModal } from "./ComplianceOnboardingModal";

/**
 * Shows compliance onboarding modal for logged-in users who haven't
 * yet acknowledged Terms, Privacy, and Data Processing.
 */
export function ComplianceOnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

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
          .select("compliance_onboarding_completed_at")
          .eq("id", user.id)
          .single();

        if (error) {
          // Profile might not exist yet (e.g. handle_new_user hasn't run)
          setShowModal(true);
          return;
        }

        setShowModal(!data?.compliance_onboarding_completed_at);
      } catch {
        setShowModal(false);
      } finally {
        setLoading(false);
      }
    };

    checkCompliance();
  }, [user?.id]);

  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <ComplianceOnboardingModal
        open={showModal}
        userId={user.id}
        onComplete={() => setShowModal(false)}
        onExit={() => setShowModal(false)}
      />
    </>
  );
}
