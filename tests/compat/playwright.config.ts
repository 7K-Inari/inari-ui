import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './ui',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5300' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'rail', use: { viewport: { width: 1152, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5300 --strictPort',
    url: 'http://localhost:5300',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NODE_ENV: 'development', VITE_MOCK_API: 'true', VITE_MOCK_AUTH: 'true', VITE_COMPAT_FIXTURE: 'true' },
  },
});
