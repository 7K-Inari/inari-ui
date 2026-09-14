import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    environmentOptions: {
      jsdom: { url: "http://localhost/" },
    },
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // The sandbox shell exports NODE_ENV=production, which makes Vite resolve
    // React's production build and breaks @testing-library's act(). Pin the
    // test env so tests run regardless of the ambient NODE_ENV.
    env: { NODE_ENV: "test" },
    // userEvent-heavy form tests exceed the 5s default under parallel load on
    // constrained CI/sandbox machines.
    testTimeout: 20000,
  },
});
