import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuth } from "@/contexts/AuthContext";
import { RouteFallbackSpinner } from "@/components/RouteFallbackSpinner";
import { BetaAccessOverlay } from "@/components/BetaAccessOverlay";
import { api } from "../../convex/_generated/api";
import { saveEmailVerifyPending } from "@/lib/emailVerifyPendingStorage";

/** Requires Convex Auth session and resolved app user (session + users row). */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  const userRow = useQuery(api.userBootstrap.myUserRow, isAuthenticated ? {} : "skip");

  if (loading || (isAuthenticated && userRow === undefined)) {
    return <RouteFallbackSpinner />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate to="/auth" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
    );
  }

  /** Block dashboard until email OTP is confirmed (signup verify provider). */
  if (userRow && userRow.emailVerificationTime == null) {
    const email = (userRow.email ?? user.email ?? "").trim().toLowerCase();
    if (email) saveEmailVerifyPending({ email });
    return <Navigate to="/auth/verify-email" replace />;
  }

  return (
    <>
      <BetaAccessOverlay />
      {children}
    </>
  );
}
