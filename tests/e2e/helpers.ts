import { expect, type BrowserContext, type Page } from "@playwright/test";

export const PASSWORD = "correct-horse-battery-9";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export async function setLocale(context: BrowserContext, locale: "ar" | "en") {
  await context.addCookies([{ name: "timora-locale", value: locale, url: "http://localhost:3000" }]);
}

export async function signUp(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-up");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.locator("button[type=submit]").click();
  await page.waitForURL(/\/dashboard/);
}

/** Signs in on the current sign-in page (keeping its ?next=), or opens /sign-in first. */
export async function signIn(page: Page, email: string, password = PASSWORD) {
  if (!new URL(page.url()).pathname.startsWith("/sign-in")) await page.goto("/sign-in");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.locator("button[type=submit]").click();
}

/** Creates an item through the real form (English UI) and returns its id. */
export async function createItem(page: Page, name: string, options: { count?: string; unit?: string; lastDone?: string } = {}) {
  await page.goto("/items/new");
  await page.getByLabel("Name").fill(name);
  if (options.count) await page.locator("#intervalCount").fill(options.count);
  if (options.unit) await page.locator("#intervalUnit").selectOption(options.unit);
  if (options.lastDone !== undefined) await page.getByLabel("Last time you did it").fill(options.lastDone);
  await page.getByRole("button", { name: "Add item" }).last().click();
  await page.waitForURL(/\/items\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url().split("/").pop()!;
}

const SUPABASE_URL = "http://127.0.0.1:54321";

/** The access token from the @supabase/ssr session cookie (chunked, base64-encoded JSON). */
export async function accessToken(context: BrowserContext): Promise<string> {
  const cookies = (await context.cookies("http://localhost:3000"))
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const raw = cookies.map((c) => c.value).join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString("utf8") : decodeURIComponent(raw);
  return JSON.parse(json).access_token as string;
}

/** Reads one column of a row as the signed-in user via the REST API, so RLS applies exactly as in the app. */
export async function readOwnColumn(context: BrowserContext, table: string, id: string, column: string): Promise<string> {
  const token = await accessToken(context);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${column}&id=eq.${id}`, {
    headers: { authorization: `Bearer ${token}`, apikey: "local-fake-publishable-key-0000" },
  });
  const rows = (await res.json()) as Array<Record<string, string>>;
  if (!rows[0]) throw new Error(`row ${id} not visible`);
  return rows[0][column]!;
}

export function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
