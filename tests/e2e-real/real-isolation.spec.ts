import { randomBytes } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * TEST-ONLY — runs against the REAL Supabase project (see playwright.real.config.ts).
 * Proves two real accounts are isolated through pages, downloads, QR scans and direct REST calls.
 * Never logs keys, access tokens, passwords or QR tokens.
 */

const SUPABASE_URL = process.env.E2E_REAL_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.E2E_REAL_SUPABASE_KEY!;
const RUN = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

type Account = { label: string; email: string; password: string; userId?: string };
const alice: Account = { label: "alice", email: `timora-e2e-alice-${RUN}@example.com`, password: `Tm-${randomBytes(12).toString("base64url")}` };
const bob: Account = { label: "bob", email: `timora-e2e-bob-${RUN}@example.com`, password: `Tm-${randomBytes(12).toString("base64url")}` };

const created = {
  accounts: [] as Array<{ email: string; userId: string }>,
  items: [] as Array<{ owner: string; id: string; name: string }>,
  notes: [
    "Each account also received one profile row and 9 starter categories (created by the sign-up trigger).",
  ],
};

test.describe.configure({ mode: "serial" });

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function accessToken(context: BrowserContext): Promise<string> {
  const cookies = (await context.cookies("http://localhost:3000"))
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const raw = cookies.map((c) => c.value).join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString("utf8") : decodeURIComponent(raw);
  return JSON.parse(json).access_token as string;
}

function userIdFromToken(token: string): string {
  return JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")).sub as string;
}

async function rest(context: BrowserContext | null, path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { apikey: PUBLISHABLE_KEY, "content-type": "application/json", ...(init.headers as Record<string, string>) };
  if (context) headers.authorization = `Bearer ${await accessToken(context)}`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function signUp(page: Page, account: Account) {
  await page.goto("/sign-up");
  await page.locator("input[name=email]").fill(account.email);
  await page.locator("input[name=password]").fill(account.password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  account.userId = userIdFromToken(await accessToken(page.context()));
  created.accounts.push({ email: account.email, userId: account.userId });
}

async function createItem(page: Page, owner: Account, name: string, lastDoneDaysAgo: number) {
  await page.goto("/items/new");
  await page.getByLabel("Name").fill(name);
  await page.locator("#intervalCount").fill("3");
  await page.locator("#intervalUnit").selectOption("month");
  await page.getByLabel("Last time you did it").fill(isoDaysAgo(lastDoneDaysAgo));
  await page.getByRole("button", { name: "Add item" }).last().click();
  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}$/, { timeout: 30_000 });
  const id = page.url().split("/").pop()!;
  created.items.push({ owner: owner.email, id, name });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return id;
}

test.afterAll(() => {
  console.log("\n===== TIMORA real-Supabase test data created (remove manually) =====");
  console.log(JSON.stringify(created, null, 2));
  console.log("====================================================================\n");
});

test("pre-check: running against the real project with Confirm email temporarily off", async () => {
  expect(SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: PUBLISHABLE_KEY } });
  const settings = (await res.json()) as { mailer_autoconfirm?: boolean; disable_signup?: boolean };
  expect(settings.disable_signup, "sign-ups must be enabled").toBe(false);
  expect(settings.mailer_autoconfirm, "Confirm email must be temporarily OFF for this test").toBe(true);
});

test("two real accounts are fully isolated", async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  for (const ctx of [aliceContext, bobContext]) {
    await ctx.addCookies([{ name: "timora-locale", value: "en", url: "http://localhost:3000" }]);
  }
  const alicePage = await aliceContext.newPage();
  const bobPage = await bobContext.newPage();

  // ── Accounts and data ────────────────────────────────────────────────────
  await signUp(alicePage, alice);
  const aliceItem = await createItem(alicePage, alice, `E2E Alice water filter ${RUN}`, 30);

  // Profile and starter categories were created by the database trigger.
  const aliceProfile = await rest(aliceContext, `profiles?select=id,locale,timezone`);
  expect(aliceProfile.status).toBe(200);
  expect(aliceProfile.body).toHaveLength(1);
  const aliceCategories = await rest(aliceContext, `categories?select=system_key`);
  expect(aliceCategories.body).toHaveLength(9);

  // Done now + undo on the real database.
  await alicePage.goto(`/items/${aliceItem}`);
  await alicePage.getByRole("button", { name: "Done now" }).click();
  const toast = alicePage.locator("[data-sonner-toast]").filter({ hasText: "Completion recorded" });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(alicePage.locator("[data-sonner-toast]").filter({ hasText: "Completion undone" })).toBeVisible();
  created.notes.push(`Alice item: 1 "initial" completion (30 days ago) and 1 "done_now" completion that was undone.`);

  const aliceTokenRow = await rest(aliceContext, `items?select=qr_token&id=eq.${aliceItem}`);
  const aliceQrToken = (aliceTokenRow.body as Array<{ qr_token: string }>)[0]!.qr_token;
  expect(aliceQrToken).toMatch(/^[0-9a-f]{64}$/);

  await signUp(bobPage, bob);
  const bobItem = await createItem(bobPage, bob, `E2E Bob plant ${RUN}`, 5);
  created.notes.push(`Bob item: 1 "initial" completion (5 days ago).`);

  // ── Bob cannot reach Alice's item through the app ────────────────────────
  for (const path of [`/items/${aliceItem}`, `/items/${aliceItem}/edit`, `/items/${aliceItem}/history`, `/items/${aliceItem}/label`]) {
    const response = await bobPage.goto(path);
    expect(response?.status(), `Bob ${path}`).toBe(404);
    await expect(bobPage.getByText(`E2E Alice water filter ${RUN}`)).toHaveCount(0);
  }
  await bobPage.goto("/items");
  await expect(bobPage.getByText(`E2E Bob plant ${RUN}`)).toBeVisible();
  await expect(bobPage.getByText(`E2E Alice water filter ${RUN}`)).toHaveCount(0);
  expect((await bobPage.request.get(`/api/items/${aliceItem}/calendar`)).status()).toBe(404);
  expect((await bobPage.request.get(`/api/items/${aliceItem}/qr?format=svg`)).status()).toBe(404);
  const scan = await bobPage.goto(`/q/${aliceQrToken}`);
  expect(scan?.status()).toBe(404);
  await expect(bobPage).not.toHaveURL(new RegExp(aliceItem));

  // ── Bob cannot reach Alice's data through the REST API (RLS + grants) ────
  expect((await rest(bobContext, `items?select=id&id=eq.${aliceItem}`)).body).toEqual([]);
  expect((await rest(bobContext, `item_overview?select=id&id=eq.${aliceItem}`)).body).toEqual([]);
  expect((await rest(bobContext, `completion_records?select=id&item_id=eq.${aliceItem}`)).body).toEqual([]);
  expect((await rest(bobContext, `profiles?select=id&id=eq.${alice.userId}`)).body).toEqual([]);
  expect((await rest(bobContext, `categories?select=id&user_id=eq.${alice.userId}`)).body).toEqual([]);

  const patch = await rest(bobContext, `items?id=eq.${aliceItem}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ name: "hacked" }),
  });
  expect(patch.body).toEqual([]);

  const del = await rest(bobContext, `items?id=eq.${aliceItem}&select=id`, { method: "DELETE", headers: { prefer: "return=representation" } });
  expect(del.body).toEqual([]);

  const foreignCompletion = await rest(bobContext, `completion_records`, {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ item_id: aliceItem, completed_on: isoDaysAgo(0), source: "done_now" }),
  });
  expect(foreignCompletion.status, "Bob inserting a completion on Alice's item must fail").toBeGreaterThanOrEqual(400);

  const spoofOwner = await rest(bobContext, `items`, {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({ user_id: alice.userId, name: "spoof", schedule_type: "none" }),
  });
  expect(spoofOwner.status, "Bob choosing user_id must be denied").toBeGreaterThanOrEqual(400);

  const rotate = await rest(bobContext, `rpc/regenerate_qr_token`, { method: "POST", body: JSON.stringify({ p_item_id: aliceItem }) });
  expect(rotate.status, "Bob rotating Alice's QR token must fail").toBeGreaterThanOrEqual(400);

  const bobProtected = await rest(bobContext, `items?id=eq.${bobItem}&select=id`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ qr_token: "a".repeat(64) }),
  });
  expect(bobProtected.status, "Even the owner cannot set qr_token directly").toBeGreaterThanOrEqual(400);

  // ── Signed-out (publishable key only) has no table access ───────────────
  for (const table of ["items", "item_overview", "completion_records", "profiles", "categories"]) {
    const anon = await rest(null, `${table}?select=id&limit=1`);
    expect(anon.status, `anon ${table}`).toBeGreaterThanOrEqual(400);
  }

  // ── Alice's data is intact and visible only to her ──────────────────────
  const aliceView = await rest(aliceContext, `items?select=name&id=eq.${aliceItem}`);
  expect(aliceView.body).toEqual([{ name: `E2E Alice water filter ${RUN}` }]);
  const aliceHistory = await rest(aliceContext, `completion_records?select=source,undone_at&item_id=eq.${aliceItem}&order=recorded_at.asc`);
  const history = aliceHistory.body as Array<{ source: string; undone_at: string | null }>;
  expect(history).toHaveLength(2);
  expect(history[0]).toMatchObject({ source: "initial", undone_at: null });
  expect(history[1]!.source).toBe("done_now");
  expect(history[1]!.undone_at).not.toBeNull();
  expect((await rest(aliceContext, `items?select=id&id=eq.${bobItem}`)).body).toEqual([]);

  // ── QR scan while signed out → sign in → returns to the item ────────────
  await aliceContext.clearCookies();
  await aliceContext.addCookies([{ name: "timora-locale", value: "en", url: "http://localhost:3000" }]);
  await alicePage.goto(`/q/${aliceQrToken}`);
  await expect(alicePage).toHaveURL(/\/sign-in\?next=/);
  await alicePage.locator("input[name=email]").fill(alice.email);
  await alicePage.locator("input[name=password]").fill(alice.password);
  await alicePage.locator("button[type=submit]").click();
  await expect(alicePage).toHaveURL(new RegExp(`/items/${aliceItem}\\?from=qr`), { timeout: 30_000 });
  await expect(alicePage.getByText("You opened this item from its QR code.")).toBeVisible();

  await aliceContext.close();
  await bobContext.close();
});
