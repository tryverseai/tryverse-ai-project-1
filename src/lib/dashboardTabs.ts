/**
 * Shared dashboard tab-label constants. Kept in their own module (not exported from
 * Dashboard.tsx directly) because Dashboard.tsx eagerly imports TryOnGuideTab — importing these
 * back from Dashboard.tsx would create a circular dependency between the two.
 */
export const GUIDE_TAB = "Try-On guide";
export const CONNECT_TAB = "Connect Store";

/** localStorage key for the mandatory Try-On Guide onboarding gate (see TryOnGuideGate.tsx). */
const TRYON_GUIDE_ACKNOWLEDGED_KEY = "tv_acknowledged_tryon_guide";

export function hasAcknowledgedTryOnGuide(): boolean {
  try {
    return localStorage.getItem(TRYON_GUIDE_ACKNOWLEDGED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTryOnGuideAcknowledged(): void {
  try {
    localStorage.setItem(TRYON_GUIDE_ACKNOWLEDGED_KEY, "1");
  } catch {
    /* best-effort — non-fatal if storage is unavailable */
  }
}
