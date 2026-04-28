import type { LegacyUserMetadata } from "@/lib/accountType";

const STORAGE_KEY = "tryverse_local_session_v2";

export type LocalSessionV2 = {
  sub: string;
  email: string;
  user_metadata: LegacyUserMetadata;
};

export function emailToLocalSubject(email: string): string {
  return `local:${email.trim().toLowerCase()}`;
}

/** True when the browser has an anonymous actor (`local:guest-…`) — not a signed-in account. */
export function isGuestLocalSession(s: LocalSessionV2 | null): boolean {
  return Boolean(s?.sub?.startsWith("local:guest-"));
}

export function readLocalSession(): LocalSessionV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as LocalSessionV2;
    if (!p || typeof p.sub !== "string" || !p.sub) return null;
    return {
      sub: p.sub,
      email: typeof p.email === "string" ? p.email : "",
      user_metadata: p.user_metadata && typeof p.user_metadata === "object" ? p.user_metadata : {},
    };
  } catch {
    return null;
  }
}

export function writeLocalSession(session: LocalSessionV2): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Anonymous browser session so API calls always carry `Authorization: Local …` (no sign-in page). */
export function ensureGuestLocalSession(): void {
  if (typeof window === "undefined") return;
  if (readLocalSession()) return;
  const id = `local:guest-${crypto.randomUUID()}`;
  writeLocalSession({
    sub: id,
    email: "",
    user_metadata: { account_type: "individual", full_name: "Guest" },
  });
}

/** `Authorization: Local <base64(JSON)>` — matches backend `parseLocalAuthorizationHeader`. */
export function encodeLocalAuthorizationHeader(): string | null {
  const s = readLocalSession();
  if (!s?.sub) return null;
  const json = JSON.stringify({ sub: s.sub, email: s.email ?? "" });
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `Local ${b64}`;
}
