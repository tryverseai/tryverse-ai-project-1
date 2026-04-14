import { Navigate, useLocation } from "react-router-dom";
import { useProfileAccountType } from "@/hooks/useProfileAccountType";
import { dashboardPathForAccountType, type AccountType } from "@/lib/accountType";
import { RouteFallbackSpinner } from "@/components/RouteFallbackSpinner";

export function AccountTypeGate({
  allowed,
  children,
}: {
  allowed: AccountType[];
  children: React.ReactNode;
}) {
  const { accountType, loading } = useProfileAccountType();
  const location = useLocation();

  if (loading) return <RouteFallbackSpinner />;

  if (!allowed.includes(accountType)) {
    const home = dashboardPathForAccountType(accountType);
    return <Navigate to={`${home}${location.search}`} replace />;
  }

  return <>{children}</>;
}
