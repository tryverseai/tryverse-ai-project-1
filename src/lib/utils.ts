import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Downloads a (typically cross-origin, e.g. Convex storage) file URL as an attachment.
 * A plain `<a href={url} download>` is silently ignored by browsers for cross-origin URLs —
 * they navigate to/open the resource instead of downloading it. Fetching the bytes and
 * downloading via a same-origin blob: URL works reliably across browsers.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

/** e.g. "tryverse-result-2026-08-18.jpg" */
export function dateStampedFilename(prefix: string, ext = "jpg"): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
