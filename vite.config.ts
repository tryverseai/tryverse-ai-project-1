import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    // Canonical local UI port for this repo (matches FRONTEND_URL / CORS defaults).
    host: true,
    port: 8080,
    strictPort: true,
    proxy: {
      // Dev: browser calls same origin (see BACKEND_URL in backendApi); Vite forwards to the API.
      // Long timeouts: sync try-on holds the POST open until the model finishes (can exceed 2–3 minutes).
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      "/health": { target: "http://127.0.0.1:3001", changeOrigin: true },
    },
    hmr: {
      // Show compile/runtime overlay in the browser (overlay off hid failures behind a blank page).
      overlay: true,
    },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
  // `lovable-tagger` replaces `react/jsx-dev-runtime` globally; that has caused blank pages in local dev.
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
