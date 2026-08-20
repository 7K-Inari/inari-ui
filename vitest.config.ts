import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@inari/ui-plugin-sdk": path.resolve(
        __dirname,
        "vendor/ui-plugin-sdk/src/index.ts",
      ),
      "@inari/ui-plugin-sdk/tokens.css": path.resolve(
        __dirname,
        "vendor/ui-plugin-sdk/src/tokens/tokens.css",
      ),
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
  },
});
