/**
 * Sanitize values bound to DOM `src` / `href` so static analysis and XSS sinks stay safe.
 */

function isLocalhostHttp(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** Safe for <img src> — https, localhost http, blob:, data:image/*, or same-origin paths. */
export function safeImageSrcForDom(value: string | null | undefined): string | undefined {
  if (value == null || value === "") return undefined;
  const v = value.trim();
  if (v.startsWith("blob:")) return v;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);/i.test(v)) return v;
  try {
    const u = new URL(v, typeof window !== "undefined" ? window.location.href : undefined);
    if (u.protocol === "https:") return u.href;
    if (u.protocol === "http:" && isLocalhostHttp(u.hostname)) return u.href;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Safe for <a href> — only http(s) URLs (blocks javascript:, data:, etc.). */
export function safeHttpHrefForDom(value: string | null | undefined): string | undefined {
  if (value == null || value === "") return undefined;
  try {
    const u = new URL(value.trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Open a validated http(s) URL in a new tab (centralizes sink for SAST). */
export function openExternalHttpUrlInNewTab(value: string | null | undefined): void {
  const u = safeHttpHrefForDom(value);
  if (u) window.open(u, "_blank", "noopener noreferrer");
}

/** Post-login in-app navigation only (blocks //evil.com and protocol-relative tricks). */
export function safeInAppRedirectPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (raw == null || typeof raw !== "string") return fallback;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return fallback;
  return path;
}

/** Paths allowed after sign-in (matches ProtectedRoute redirect targets + /admin). */
const POST_LOGIN_REDIRECT_PREFIXES = [
  "/dashboard",
  "/dashboard/business",
  "/dashboard/individual",
  "/pricing",
  "/widget-preview",
  "/studio",
  "/try-on-studio",
  "/admin",
] as const;

/**
 * Same-origin post-login navigation only: relative path must match an allowed app prefix.
 * Allowlisting satisfies SAST open-redirect rules; keep in sync with protected routes.
 */
export function postLoginRedirectPath(raw: string | null | undefined): string {
  const fallback = "/dashboard";
  if (raw == null || typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t || !t.startsWith("/") || t.startsWith("//") || t.includes("://")) return fallback;
  const pathOnly = t.split(/[?#]/)[0] ?? "";
  const allowed = POST_LOGIN_REDIRECT_PREFIXES.some(
    (pre) => pathOnly === pre || pathOnly.startsWith(`${pre}/`)
  );
  return allowed ? t : fallback;
}

/**
 * Validates Paystack / Flutterwave checkout URLs then redirects.
 * Centralizes the redirect so SAST can treat the URL as gated before `location.assign`.
 */
export function assignTrustedPaymentCheckoutUrl(rawUrl: string, rail: "paystack" | "flutterwave"): void {
  const u = new URL(rawUrl);
  if (u.protocol !== "https:") throw new Error("Invalid payment URL");
  const host = u.hostname.toLowerCase();
  if (rail === "paystack") {
    if (host !== "checkout.paystack.com" && !host.endsWith(".paystack.com")) {
      throw new Error("Invalid payment redirect host");
    }
  } else {
    // Test-mode checkout links come back from a *different* domain (dev-flutterwave.com), not a
    // flutterwave.com subdomain — confirmed via a live test-mode /v3/payments call, which returned
    // https://checkout-v2.dev-flutterwave.com/... This is what silently broke every USD checkout
    // (Paystack doesn't support USD on this account, so USD always routes through Flutterwave).
    if (
      host !== "checkout.flutterwave.com" &&
      !host.endsWith(".flutterwave.com") &&
      host !== "rave.flutterwave.com" &&
      !host.endsWith(".flwv.io") &&
      !host.endsWith(".dev-flutterwave.com")
    ) {
      throw new Error("Invalid payment redirect host");
    }
  }
  window.location.assign(u.href);
}
