import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://gymos:gymos@localhost:5432/gymos_e2e_test";
// Throwaway, for the test server only. Tests use it to sign links the way an
// email would carry them (unsubscribe, D-118).
export const E2E_SESSION_SECRET = "e2e-session-secret-not-for-production-0123456789";

// Runs against a production build (`npm run build` first) on a seeded,
// throwaway database. Chromium comes from the environment if provided.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", dependencies: ["setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", dependencies: ["setup"], use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/admin/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      SESSION_SECRET: E2E_SESSION_SECRET,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      CRON_SECRET: "e2e-cron-secret-0123456789",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "",
      // Email isn't set up in the tests, so single-use links show on screen (D-115).
      SHOW_EMAIL_LINKS: "true",
    },
  },
});
