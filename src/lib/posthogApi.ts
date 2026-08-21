/**
 * PostHog Query API client for admin analytics — proxied through the backend
 * (`/api/admin/analytics/posthog-query`) so the Personal API Key stays server-side.
 *
 * A Personal API Key must never ship in frontend code: unlike the public phc_* ingestion
 * token (used for client-side event capture in `posthog.ts`), a Personal API Key carries
 * broad account/org query access. Configure `POSTHOG_PROJECT_ID` / `POSTHOG_PERSONAL_API_KEY`
 * / `POSTHOG_HOST` on the backend (Railway), not as VITE_ frontend variables.
 */
import { postHogAdminQuery, type PostHogQueryResult } from "@/lib/backendApi";

export type { PostHogQueryResult };

export async function postHogQuery<T = unknown>(
  adminKey: string,
  query: { kind: string; query: string },
  name: string
): Promise<PostHogQueryResult<T>> {
  return postHogAdminQuery<T>(adminKey, query, name);
}

/** HogQL date filter for the given range */
export function hogqlDateFilter(range: "today" | "7d" | "30d" | "all"): string {
  switch (range) {
    case "today":
      return "timestamp >= today()";
    case "7d":
      return "timestamp >= now() - INTERVAL 7 DAY";
    case "30d":
      return "timestamp >= now() - INTERVAL 30 DAY";
    default:
      return "1=1";
  }
}
