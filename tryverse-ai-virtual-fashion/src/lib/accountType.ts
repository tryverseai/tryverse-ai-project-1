export type AccountType = "business" | "individual";

export const DASHBOARD_BUSINESS = "/dashboard/business";
export const DASHBOARD_INDIVIDUAL = "/dashboard/individual";

export function dashboardPathForAccountType(type: AccountType | null | undefined): string {
  if (type === "individual") return DASHBOARD_INDIVIDUAL;
  return DASHBOARD_BUSINESS;
}

/** First dashboard tab id/label after sign-in when URL has no `tab` param. */
export function defaultDashboardTabValue(type: AccountType): string {
  return type === "individual" ? "guide" : "Try-On guide";
}
