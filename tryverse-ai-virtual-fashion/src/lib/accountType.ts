export type AccountType = "business" | "individual";

export const DASHBOARD_BUSINESS = "/dashboard/business";
export const DASHBOARD_INDIVIDUAL = "/dashboard/individual";

export function dashboardPathForAccountType(type: AccountType | null | undefined): string {
  if (type === "individual") return DASHBOARD_INDIVIDUAL;
  return DASHBOARD_BUSINESS;
}
