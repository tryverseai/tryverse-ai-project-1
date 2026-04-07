import { ConvexReactClient } from "convex/react";

const raw = typeof import.meta.env.VITE_CONVEX_URL === "string" ? import.meta.env.VITE_CONVEX_URL.trim() : "";

if (!raw) {
  console.error("TryVerse: VITE_CONVEX_URL is required (Convex Auth + data).");
}

export const convexReactClient = raw !== "" ? new ConvexReactClient(raw) : null;
