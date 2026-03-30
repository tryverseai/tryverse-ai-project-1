import { Navigate, useLocation } from "react-router-dom";
import { useProfileAccountType } from "@/hooks/useProfileAccountType";
import { dashboardPathForAccountType } from "@/lib/accountType";

/**
 * /dashboard → canonical home for the user’s account type.
 */
export function DashboardHomeRedirect() {
  const { accountType, loading } = useProfileAccountType();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
      </div>
    );
  }

  const target = dashboardPathForAccountType(accountType);
  return <Navigate to={{ pathname: target, search: location.search }} replace />;
}
