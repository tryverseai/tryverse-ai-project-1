/** True when Convex is configured for app data (dashboard, API keys, billing, etc.). */
export function isConvexDataEnabled(): boolean {
  return typeof import.meta.env.VITE_CONVEX_URL === "string" && import.meta.env.VITE_CONVEX_URL.trim() !== "";
}
