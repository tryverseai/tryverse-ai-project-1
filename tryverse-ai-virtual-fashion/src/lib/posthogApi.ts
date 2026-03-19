/**
 * PostHog Query API client for admin analytics.
 * Requires VITE_POSTHOG_PROJECT_ID and VITE_POSTHOG_PERSONAL_API_KEY.
 */

const PROJECT_ID = import.meta.env.VITE_POSTHOG_PROJECT_ID;
const PERSONAL_KEY = import.meta.env.VITE_POSTHOG_PERSONAL_API_KEY;
const HOST = (import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof PERSONAL_KEY === "string" && PERSONAL_KEY.trim()) {
    headers["Authorization"] = `Bearer ${PERSONAL_KEY}`;
  }
  return headers;
}

export function isPostHogApiConfigured(): boolean {
  return typeof PROJECT_ID === "string" && !!PROJECT_ID.trim() && typeof PERSONAL_KEY === "string" && !!PERSONAL_KEY.trim();
}

export interface PostHogQueryResult<T = unknown> {
  results?: T[][];
  columns?: string[];
  types?: string[];
  hasMore?: boolean;
}

export async function postHogQuery<T = unknown>(query: { kind: string; query: string }, name: string): Promise<PostHogQueryResult<T>> {
  if (!isPostHogApiConfigured()) {
    throw new Error("PostHog API not configured. Set VITE_POSTHOG_PROJECT_ID and VITE_POSTHOG_PERSONAL_API_KEY.");
  }
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ query, name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error ${res.status}: ${text}`);
  }
  return res.json();
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
