const STORAGE_KEY = "tryverse_device_fingerprint_v1";

export function getOrCreateDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
    if (id.length < 8) {
      id = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
