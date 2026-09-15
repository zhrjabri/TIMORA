import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createItem, isoDaysAgo, setLocale, signUp, uniqueEmail } from "./helpers";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("mobile Arabic layout: no horizontal scroll, bottom navigation and reachable Done now", async ({ page, context }) => {
  await setLocale(context, "en");
  await signUp(page, uniqueEmail("mobile"));
  const id = await createItem(page, "Water filter", { count: "3", unit: "month", lastDone: isoDaysAgo(95) });

  await setLocale(context, "ar");
  for (const path of ["/", "/dashboard", "/items", `/items/${id}`, "/items/new", "/categories", "/settings", `/items/${id}/label`]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expectNoHorizontalScroll(page);
  }

  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(5);

  const done = page.getByRole("button", { name: /تم الآن/ }).first();
  await expect(done).toBeVisible();
  const box = await done.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  // Only one brand lockup is visible in the mobile header.
  await expect(page.locator("header").getByText("تيمورا", { exact: true }).filter({ visible: true })).toHaveCount(1);

  await done.click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "سُجّل الإنجاز" })).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});

test("dark mode dashboard passes automated contrast checks", async ({ page, context }) => {
  await setLocale(context, "ar");
  await signUp(page, uniqueEmail("dark"));
  // Sign-in restores the profile theme, so choose dark afterwards.
  await context.addCookies([{ name: "timora-theme", value: "dark", url: "http://localhost:3000" }]);
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const results = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  expect(results.violations.filter((v) => v.id === "color-contrast")).toEqual([]);
});
