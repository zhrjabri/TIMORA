import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the production build against the local Supabase stand-in
 * (tests/support/fake-supabase.mjs), which executes the real migrations and RLS in PGlite.
 * NEXT_PUBLIC_* values are inlined at build time, so the build uses the same URLs.
 */
const APP_URL = "http://localhost:3000";
const SUPABASE_URL = "http://127.0.0.1:54321";
const env = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-fake-publishable-key-0000",
  NEXT_PUBLIC_SITE_URL: APP_URL,
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }, testIgnore: /mobile.spec.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: "node tests/support/fake-supabase.mjs 54321",
      url: `${SUPABASE_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run build && npm run start -- -p 3000",
      url: APP_URL,
      env,
      // Always build and start a fresh app with the fake Supabase env, never a server already on :3000 that may use .env.local.
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
