import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// NOTE: the @module-federation/vite plugin was removed from the dev config —
// with an empty `remotes` map it breaks the dev bundle (virtual loadShare
// modules fail pre-transform → blank page). The MF host runtime is M4 scope
// (see M4-W2 task); it should return behind a runtime remote registry, not a
// static empty config.
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
