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

/** Post-login in-app navigation only (blocks //evil.com and protocol-relative tricks). */
export function safeInAppRedirectPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (raw == null || typeof raw !== "string") return fallback;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return fallback;
  return path;
}

/** Only allow redirecting the browser to known payment checkout hosts. */
export function isTrustedPaymentCheckoutUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "checkout.paystack.com" || h.endsWith(".paystack.com")) return true;
    if (
      h === "checkout.flutterwave.com" ||
      h.endsWith(".flutterwave.com") ||
      h === "rave.flutterwave.com" ||
      h.endsWith(".flwv.io")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
