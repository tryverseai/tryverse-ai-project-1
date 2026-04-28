/**
 * Routes are open: {@link AuthProvider} ensures a guest `Local` session so the API always has an actor.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
