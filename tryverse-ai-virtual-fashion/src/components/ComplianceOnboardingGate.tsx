import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ComplianceOnboardingModal } from "./ComplianceOnboardingModal";
import type { PolicyAudience } from "@/content/policyContent";
import { complianceDoneSessionKey } from "@/lib/complianceStorage";
import { getStoredAdminKey } from "@/lib/backendApi";
import { isConvexDataEnabled } from "@/lib/convexData";
import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

/**
 * Shows compliance onboarding modal for logged-in users who haven't
 * yet acknowledged Terms, Privacy, and Data Processing.
 */
export function ComplianceOnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const convexOn = isConvexDataEnabled();
  const { profile: cxProfile, loading: cxLoading } = useSyncedConvexProfile();
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

    if (!convexOn) {
      setShowModal(false);
      setLoading(false);
      return;
    }

    setLoading(cxLoading);
    if (cxLoading) return;

    const metaAudience: PolicyAudience =
      user.user_metadata?.account_type === "individual" ? "individual" : "business";
    const sessionFlag = sessionStorage.getItem(complianceDoneSessionKey(user.id)) === "1";

    const audience: PolicyAudience =
      cxProfile?.account_type === "individual" || cxProfile?.account_type === "business"
        ? cxProfile.account_type
        : metaAudience;
    setPolicyAudience(audience);

    if (sessionFlag) {
      setShowModal(false);
      return;
    }

    if (!cxProfile) {
      setShowModal(true);
      sessionStorage.removeItem(complianceDoneSessionKey(user.id));
      return;
    }

    if (cxProfile.compliance_onboarding_completed_at) {
      sessionStorage.setItem(complianceDoneSessionKey(user.id), "1");
      setShowModal(false);
    } else {
      sessionStorage.removeItem(complianceDoneSessionKey(user.id));
      setShowModal(true);
    }
  }, [user?.id, skipCompliance, user?.user_metadata?.account_type, convexOn, cxProfile, cxLoading]);

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
