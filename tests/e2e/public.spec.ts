import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setLocale } from "./helpers";

test.describe("public pages", () => {
  test("Arabic is the default, right-to-left interface", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("متى فعلتها آخر مرة");
  });

  test("language switch changes to English left-to-right and persists", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("When did I last do this?");
  });

  test("legal pages render in both languages", async ({ page, context }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "سياسة الخصوصية" })).toBeVisible();
    await setLocale(context, "en");
    await page.goto("/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
  });

  test("unknown routes show the 404 page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
  });

  test("protected routes redirect to sign-in and keep the destination", async ({ page }) => {
    await page.goto("/items/new");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fitems%2Fnew/);
  });

  test("a scanned QR link asks signed-out visitors to sign in and returns them afterwards", async ({ page }) => {
    const token = "a".repeat(64);
    await page.goto(`/q/${token}`);
    await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=%2Fq%2F${token}`));
    await expect(page.getByRole("status")).toContainText("سجّل الدخول لفتح العنصر");
  });

  test("signed-out API calls are rejected", async ({ request }) => {
    const id = "3b9f0a52-9b8e-4d6a-8f0e-6a8f1f2b7c11";
    expect((await request.get(`/api/items/${id}/qr?format=png`)).status()).toBe(401);
    expect((await request.get(`/api/items/${id}/calendar`)).status()).toBe(401);
  });

  test("security headers are present", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the PWA manifest and icons are served", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    expect((await request.get("/icons/icon-512.png")).status()).toBe(200);
    expect((await request.get("/favicon.ico")).status()).toBe(200);
    expect((await request.get("/sw.js")).status()).toBe(200);
  });

  for (const path of ["/", "/sign-in", "/sign-up", "/forgot-password", "/privacy"]) {
    for (const locale of ["ar", "en"] as const) {
      test(`${path} has no serious accessibility violations (${locale})`, async ({ page, context }) => {
        await setLocale(context, locale);
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual([]);
      });
    }
  }
});
