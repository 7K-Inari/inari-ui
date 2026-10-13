import { defineConfig } from "@playwright/test";

// Usability UI tests (axe a11y, visual regression, responsive overflow).
// Functional e2e belongs to the release bundle; this suite only checks
// usability properties of the console against the mocked API + mock auth.
export default defineConfig({
  testDir: "./tests/ui",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  // 2 workers: screenshot rendering is timing-sensitive under CPU contention.
  workers: 2,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5300",
    // Deterministic rendering: fixed clock, animations frozen in screenshots.
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "rail", use: { viewport: { width: 1152, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "npm run dev -- --port 5300 --strictPort",
    url: "http://localhost:5300",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "development",
      VITE_MOCK_API: "true",
      VITE_MOCK_AUTH: "true",
    },
  },
});
