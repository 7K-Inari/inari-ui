import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The Module Federation host runtime is initialized at runtime via
// @module-federation/runtime (see src/ext/host-runtime.ts) — remotes are
// registered from the backend extension registry, not statically, so the
// @module-federation/vite plugin is intentionally not used.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Local dev against the kind platform cluster: proxy API calls to the
  // port-forwarded inari-server (kubectl port-forward deployment/…-server 8081:8080).
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8081",
        changeOrigin: true,
      },
    },
  },
});
