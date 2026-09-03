/** TryVerse is B2B-only — "individual"/B2C accounts were removed (no product surface ever
 * fully offered them, and no account ever used one; see git history for the prior variant). */
export type AccountType = "business";

/** Profile-like fields stored in the browser session (no remote auth provider). */
export type LegacyUserMetadata = {
  account_type?: AccountType;
  brand_name?: string;
  full_name?: string;
  role?: string;
  plan?: string;
};

const DASHBOARD_BUSINESS = "/dashboard/business";

export function dashboardPathForAccountType(_type?: AccountType | null): string {
  return DASHBOARD_BUSINESS;
}

export function defaultDashboardTabValue(_type: AccountType): string {
  return "Try-On guide";
}

/**
 * Normalizes any raw account-type string (from DB or JWT metadata) into a typed
 * `AccountType` value. Returns `null` when the input is absent or unrecognised.
 * Single source of truth — used by AuthContext, useProfileAccountType, and
 * useSyncedConvexProfile instead of each implementing the same trimming/lowercasing.
 * A legacy "individual" value (from before the account type was removed) maps to
 * "business" rather than null, so no old row is treated as unrecognised.
 */
export function normalizeAccountType(raw: string | null | undefined): AccountType | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "business" || s === "brand" || s === "individual") return "business";
  return null;
}
