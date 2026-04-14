import { Navigate, useLocation } from "react-router-dom";
import { useProfileAccountType } from "@/hooks/useProfileAccountType";
import { dashboardPathForAccountType, defaultDashboardTabValue } from "@/lib/accountType";
import { RouteFallbackSpinner } from "@/components/RouteFallbackSpinner";

/**
 * /dashboard → canonical home for the user's account type.
 */
export function DashboardHomeRedirect() {
  const { accountType, loading } = useProfileAccountType();
  const location = useLocation();

  if (loading) return <RouteFallbackSpinner />;

  const target = dashboardPathForAccountType(accountType);
  const params = new URLSearchParams(location.search);
  if (!params.has("tab")) {
    params.set("tab", defaultDashboardTabValue(accountType));
  }
  const search = `?${params.toString()}`;
  return <Navigate to={{ pathname: target, search }} replace />;
}
