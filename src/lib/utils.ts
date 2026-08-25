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
  if (blob.size === 0) throw new Error("Download failed — empty file");
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking synchronously right after click() is a known race: some browsers read the blob
  // for the download asynchronously, so an immediate revoke can invalidate it before the
  // download actually starts, failing silently with no error the caller can catch. Deferring
  // the revoke lets the download begin first.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
}

/** e.g. "tryverse-result-2026-08-18.jpg" */
export function dateStampedFilename(prefix: string, ext = "jpg"): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
