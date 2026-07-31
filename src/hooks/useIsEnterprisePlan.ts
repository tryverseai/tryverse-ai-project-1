import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

/**
 * Local placeholder for Enterprise-tier gating in the UI.
 *
 * A separate workstream is adding a backend `requirePlan('enterprise')`
 * middleware plus a first-class plan-check endpoint in Convex. That work may
 * not have shipped yet, so this hook reads `plan_id` (falling back to
 * `current_plan_id`) straight off the profile row already returned by
 * `GET /api/account/me` (via `useSyncedConvexProfile`) — see
 * `convex/schema.ts`'s `profiles` table for the field shape.
 *
 * IMPORTANT: this is a UI convenience only. It gates which components render,
 * nothing more — it must never be treated as the security boundary. The
 * server must independently enforce plan access on every Enterprise endpoint
 * once the real `requirePlan('enterprise')` middleware lands.
 */
export function useIsEnterprisePlan(): boolean {
  const { profile } = useSyncedConvexProfile();
  const row = profile as Record<string, unknown> | null;
  if (!row) return false;

  const planId =
    (typeof row.plan_id === "string" && row.plan_id) ||
    (typeof row.current_plan_id === "string" && row.current_plan_id) ||
    "";

  return planId.trim().toLowerCase() === "enterprise";
}
