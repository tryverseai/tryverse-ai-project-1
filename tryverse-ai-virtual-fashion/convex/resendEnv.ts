/**
 * Resend / Convex env values often pick up BOM or trailing newlines from copy-paste,
 * which makes Resend return "API key is invalid".
 */
export function trimResendSecret(raw: string | undefined): string {
  return (raw ?? "").replace(/^\uFEFF/, "").trim();
}
