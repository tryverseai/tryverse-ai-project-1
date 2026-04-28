export type AccountType = "business" | "individual";

/** Profile-like fields stored in the browser session (no remote auth provider). */
export type LegacyUserMetadata = {
  account_type?: AccountType;
  brand_name?: string;
  full_name?: string;
  role?: string;
  plan?: string;
};

const DASHBOARD_BUSINESS = "/dashboard/business";
const DASHBOARD_INDIVIDUAL = "/dashboard/individual";

export function dashboardPathForAccountType(type: AccountType | null | undefined): string {
  if (type === "individual") return DASHBOARD_INDIVIDUAL;
  return DASHBOARD_BUSINESS;
}

/**
 * Normalizes any raw account-type string (from DB or JWT metadata) into a typed
 * `AccountType` value. Returns `null` when the input is absent or unrecognised.
 * Single source of truth — used by AuthContext, useProfileAccountType, and
 * useSyncedConvexProfile instead of each implementing the same trimming/lowercasing.
 */
export function normalizeAccountType(raw: string | null | undefined): AccountType | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "individual") return "individual";
  if (s === "business" || s === "brand") return "business";
  return null;
}

/** First dashboard tab id/label after sign-in when URL has no `tab` param. */
export function defaultDashboardTabValue(type: AccountType): string {
  return type === "individual" ? "guide" : "Try-On guide";
}
