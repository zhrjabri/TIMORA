import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * TEST-ONLY: two-account authentication and RLS isolation against the REAL Supabase project.
 *
 * - Expects TIMORA already running locally on 127.0.0.1:3000, built from .env.local.
 * - Uses only the public URL and publishable key from .env.local; never a secret key.
 * - Creates real test accounts and data. Run only when "Confirm email" is temporarily OFF,
 *   and remove the created data afterwards (the run prints what it created).
 * - Traces and videos are disabled so tokens and keys are never written to disk.
 *
 * Run: npx playwright test --config playwright.real.config.ts
 */
function readEnvLocal(): Record<string, string> {
  const text = readFileSync(".env.local", "utf8");
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

const env = readEnvLocal();
if (!env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("https://") || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) {
  throw new Error("playwright.real.config.ts requires a real Supabase URL and publishable key in .env.local");
}
process.env.E2E_REAL_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.E2E_REAL_SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default defineConfig({
  testDir: "tests/e2e-real",
  outputDir: "test-results/real-supabase",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3000",
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
});
