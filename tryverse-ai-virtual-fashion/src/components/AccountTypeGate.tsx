import { Navigate, useLocation } from "react-router-dom";
import { useProfileAccountType } from "@/hooks/useProfileAccountType";
import { dashboardPathForAccountType, type AccountType } from "@/lib/accountType";

export function AccountTypeGate({
  allowed,
  children,
}: {
  allowed: AccountType[];
  children: React.ReactNode;
}) {
  const { accountType, loading } = useProfileAccountType();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
      </div>
    );
  }

  if (!allowed.includes(accountType)) {
    const home = dashboardPathForAccountType(accountType);
    return <Navigate to={`${home}${location.search}`} replace />;
  }

  return <>{children}</>;
}
