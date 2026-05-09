import { Navigate, useLocation } from "react-router-dom";
import { useProfileAccountType } from "@/hooks/useProfileAccountType";
import { dashboardPathForAccountType, type AccountType } from "@/lib/accountType";
import { RouteFallbackSpinner } from "@/components/RouteFallbackSpinner";
import { useAdminOperatorBypass } from "@/hooks/useAdminOperatorBypass";

export function AccountTypeGate({
  allowed,
  children,
}: {
  allowed: AccountType[];
  children: React.ReactNode;
}) {
  const { bypass: adminBypass, checking: adminChecking } = useAdminOperatorBypass();
  const { accountType, loading } = useProfileAccountType();
  const location = useLocation();

  if (adminChecking || loading) return <RouteFallbackSpinner />;

  /** Admin API session: allow both business and individual routes for support testing. */
  if (adminBypass) return <>{children}</>;

  if (!allowed.includes(accountType)) {
    const home = dashboardPathForAccountType(accountType);
    return <Navigate to={`${home}${location.search}`} replace />;
  }

  return <>{children}</>;
}
