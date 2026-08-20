import { useSyncedConvexProfile } from "@/hooks/useSyncedConvexProfile";

/**
 * UI convenience only — gates which components render, nothing more. The server
 * independently enforces this via `blockFreePlanVideo` in backend/src/routes/aiStudio.ts.
 * Used to hide/gate AI Video, which is not available on the Free plan (see CREDIT_COSTS /
 * plan entitlements in backend/src/services/credits.ts).
 */
export function useIsFreePlan(): boolean {
  const { profile } = useSyncedConvexProfile();
  const row = profile as Record<string, unknown> | null;
  if (!row) return true; // no profile yet — treat as most-restricted until it loads

  const planId =
    (typeof row.plan_id === "string" && row.plan_id) ||
    (typeof row.current_plan_id === "string" && row.current_plan_id) ||
    "free";

  return planId.trim().toLowerCase() === "free";
}
