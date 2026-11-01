import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Uses an in-process PGlite database so the suite needs no external services.
    command: `npm run db:setup && npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/en`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_URL: process.env.E2E_DATABASE_URL ?? "pglite:./.data/e2e", AUTH_SECRET: "e2e-only-secret-not-for-production-0123456789", NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
  },
});
