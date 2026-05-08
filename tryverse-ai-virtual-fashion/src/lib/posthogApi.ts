/**
 * PostHog Query API client for admin analytics.
 * Requires VITE_POSTHOG_PROJECT_ID (numeric project id from Project Settings) and
 * VITE_POSTHOG_PERSONAL_API_KEY — a Personal API Key from Profile → Personal API Keys
 * (not the browser phc_* project token). Prefer minimal scopes: HogQL/query read access.
 */

const PROJECT_ID = import.meta.env.VITE_POSTHOG_PROJECT_ID;
const PERSONAL_KEY =
  typeof import.meta.env.VITE_POSTHOG_PERSONAL_API_KEY === "string"
    ? import.meta.env.VITE_POSTHOG_PERSONAL_API_KEY.trim()
    : import.meta.env.VITE_POSTHOG_PERSONAL_API_KEY;
/** Use the same ingestion host region as posthog-js (EU projects need https://eu.i.posthog.com). */
const HOST = (import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof PERSONAL_KEY === "string" && PERSONAL_KEY.trim()) {
    headers["Authorization"] = `Bearer ${PERSONAL_KEY}`;
  }
  return headers;
}

export function isPostHogApiConfigured(): boolean {
  const pid = typeof PROJECT_ID === "string" ? PROJECT_ID.trim() : "";
  const pk = typeof PERSONAL_KEY === "string" ? PERSONAL_KEY.trim() : "";
  return !!pid && !!pk;
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
  const projectId =
    typeof PROJECT_ID === "string" ? PROJECT_ID.trim() : String(PROJECT_ID ?? "").trim();
  const res = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ query, name }),
  });
  if (!res.ok) {
    const text = await res.text();
    let hint = "";
    if (res.status === 401 || res.status === 403) {
      try {
        const j = JSON.parse(text) as { detail?: string };
        const d = typeof j?.detail === "string" ? j.detail.toLowerCase() : "";
        if (d.includes("invalid") || d.includes("authentication")) {
          hint =
            " Hint: Use a Personal API Key from PostHog (profile menu → Personal API Keys), not the phc_* project token. Grant query/HogQL read access. EU-hosted projects must set VITE_POSTHOG_HOST=https://eu.i.posthog.com to match ingestion, then redeploy.";
        }
      } catch {
        hint =
          " Hint: Verify VITE_POSTHOG_PERSONAL_API_KEY is a Personal API Key (Dashboard → Profile → Personal API Keys) with query access — not phc_*.";
      }
    }
    throw new Error(`PostHog API error ${res.status}: ${text}${hint}`);
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
