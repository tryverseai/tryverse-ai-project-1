/**
 * Shared dashboard tab-label constants. Kept in their own module (not exported from
 * Dashboard.tsx directly) because Dashboard.tsx eagerly imports TryOnGuideTab — importing these
 * back from Dashboard.tsx would create a circular dependency between the two.
 */
export const GUIDE_TAB = "Try-On guide";
export const CONNECT_TAB = "Connect Store";
