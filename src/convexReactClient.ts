import { ConvexReactClient } from "convex/react";

const url = typeof import.meta.env.VITE_CONVEX_URL === "string" ? import.meta.env.VITE_CONVEX_URL.trim() : "";
if (!url) {
  throw new Error("Missing VITE_CONVEX_URL — set it to your Convex deployment URL (Convex dashboard → Settings → Deployment URL).");
}

export const convexReactClient = new ConvexReactClient(url);
