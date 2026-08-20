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
      // The SDK is consumed from a git dependency that ships TypeScript
      // source only (dist is not published); resolve it to its source.
      "@inari/ui-plugin-sdk/tokens.css": path.resolve(
        __dirname,
        "vendor/ui-plugin-sdk/src/tokens/tokens.css",
      ),
      "@inari/ui-plugin-sdk": path.resolve(
        __dirname,
        "vendor/ui-plugin-sdk/src/index.ts",
      ),
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
