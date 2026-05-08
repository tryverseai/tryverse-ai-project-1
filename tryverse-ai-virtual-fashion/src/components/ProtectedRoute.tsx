import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RouteFallbackSpinner } from "@/components/RouteFallbackSpinner";

/** Requires Convex Auth session and resolved app user (session + users row). */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <RouteFallbackSpinner />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate to="/auth" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
    );
  }

  return <>{children}</>;
}
