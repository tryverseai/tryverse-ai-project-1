import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

export function initSentry(): boolean {
  if (typeof dsn !== "string" || !dsn.trim()) return false;
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || "development",
      // Tracing can throw or misbehave in some dev environments; keep prod-only.
      integrations: import.meta.env.PROD ? [Sentry.browserTracingIntegration()] : [],
      tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,

      beforeSend(event, hint) {
        if (event.request?.headers) {
          const headers = { ...event.request.headers };
          delete (headers as Record<string, unknown>)["authorization"];
          event.request = { ...event.request, headers };
        }
        return event;
      },
    });
    return true;
  } catch {
    return false;
  }
}

export function setSentryUser(user: { id: string; email?: string } | null): void {
  if (!dsn) return;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email ?? undefined });
  } else {
    Sentry.setUser(null);
  }
}

export function captureSentryException(
  error: Error,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }
): void {
  if (!dsn) return;
  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
  });
}

export function isSentryEnabled(): boolean {
  return !!dsn;
}

export { Sentry };
