/**
 * Full-screen centered loading spinner used by auth/routing guards while session
 * or account-type data is still loading. Extracted from ProtectedRoute,
 * AccountTypeGate, and DashboardHomeRedirect which all used identical markup.
 */
export function RouteFallbackSpinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
    </div>
  );
}
