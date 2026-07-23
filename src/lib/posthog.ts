import posthog from "posthog-js";

const key = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

export function initPostHog(): boolean {
  if (typeof key !== "string" || !key.trim()) return false;
  try {
    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
    });
    return true;
  } catch {
    return false;
  }
}

export function isPostHogReady(): boolean {
  return typeof (posthog as { __loaded?: boolean }).__loaded === "boolean" && (posthog as { __loaded?: boolean }).__loaded;
}

export function posthogCapture(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (isPostHogReady()) posthog.capture(event, properties);
}

export function posthogIdentify(
  userId: string,
  traits?: { email?: string; created_at?: string; plan?: string }
): void {
  if (isPostHogReady()) posthog.identify(userId, traits);
}

export function posthogReset(): void {
  if (isPostHogReady()) posthog.reset();
}
