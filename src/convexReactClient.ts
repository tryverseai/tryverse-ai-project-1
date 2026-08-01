import { ConvexReactClient } from "convex/react";

/**
 * Convex deployment URL resolution.
 *
 * Order:
 * 1. `VITE_CONVEX_URL` (build-time env — Vercel / local `.env`).
 * 2. `localStorage["tryverse.convexUrl"]` (runtime override used by the in-app setup screen,
 *    so environments that cannot inject build-time env vars — e.g. the Lovable preview —
 *    can still boot the app).
 *
 * Never throws at import time: a hard throw here crashes the whole bundle before React mounts
 * and produces a blank preview instead of an actionable UI.
 */
export const CONVEX_URL_STORAGE_KEY = "tryverse.convexUrl";

function normalizeConvexUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed;
}

function readRuntimeOverride(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeConvexUrl(window.localStorage.getItem(CONVEX_URL_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function getConvexUrl(): string {
  return normalizeConvexUrl(import.meta.env.VITE_CONVEX_URL) || readRuntimeOverride();
}

export function setConvexUrlOverride(url: string): boolean {
  const normalized = normalizeConvexUrl(url);
  if (!normalized || typeof window === "undefined") return false;
  window.localStorage.setItem(CONVEX_URL_STORAGE_KEY, normalized);
  return true;
}

export const convexUrl = getConvexUrl();

/** `null` only when no deployment URL is configured; App renders the setup screen in that case. */
export const convexReactClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
