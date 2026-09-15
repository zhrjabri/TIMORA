import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createItem, isoDaysAgo, readOwnColumn, setLocale, signUp, uniqueEmail } from "./helpers";

test.describe("items", () => {
  test.beforeEach(async ({ page, context }) => {
    await setLocale(context, "en");
    await signUp(page, uniqueEmail("items"));
  });

  test("new accounts see a helpful empty dashboard with starter categories", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Start with the first thing you want to remember" })).toBeVisible();
    await page.goto("/categories");
    for (const name of ["Home", "Vehicle", "Personal care", "Health", "Pets", "Plants", "Documents", "Lent items", "Other"]) {
      await expect(page.locator("main").getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test("create, done now with undo, custom date, history, edit, archive and delete", async ({ page }) => {
    const id = await createItem(page, "Kitchen water filter", { count: "3", unit: "month", lastDone: isoDaysAgo(100) });
    await expect(page.getByText("Overdue", { exact: true }).first()).toBeVisible();

    // Done now → toast → undo
    await page.getByRole("button", { name: "Done now" }).click();
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Completion recorded" });
    await expect(toast).toBeVisible();
    await expect(page.getByText("On track", { exact: true }).first()).toBeVisible();
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Completion undone" })).toBeVisible();
    await expect(page.getByText("Overdue", { exact: true }).first()).toBeVisible();

    // Past date completion
    await page.getByRole("button", { name: "Another date" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Completion date").fill(isoDaysAgo(10));
    await dialog.getByLabel("Note").fill("Replaced cartridge");
    await dialog.getByRole("button", { name: "Record" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("On track", { exact: true }).first()).toBeVisible();

    // Full history keeps the undone record visible
    await page.goto(`/items/${id}/history`);
    await expect(page.getByText("Undone", { exact: true })).toBeVisible();
    await expect(page.getByText("Replaced cartridge")).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

    // Edit
    await page.goto(`/items/${id}/edit`);
    await page.getByLabel("Name").fill("Kitchen RO filter");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kitchen RO filter" })).toBeVisible();

    // Archive and restore
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("This item is archived.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Done now" })).toHaveCount(0);
    await page.getByRole("button", { name: "Restore from archive" }).click();
    await expect(page.getByRole("button", { name: "Done now" })).toBeVisible();

    // Delete requires confirmation
    await page.getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Permanently delete");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Kitchen RO filter" })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/items$/);
    expect((await page.request.get(`/items/${id}`)).status()).toBe(404);
  });

  test("validation errors are shown next to fields", async ({ page }) => {
    await page.goto("/items/new");
    await page.getByLabel("Name").fill("");
    await page.locator("#intervalCount").fill("0");
    await page.getByRole("button", { name: "Add item" }).last().click();
    await expect(page.getByText("This field is required.")).toBeVisible();
    await expect(page.getByText("Enter a number from 1 to 1000.")).toBeVisible();
  });

  test("dashboard answers what is overdue, due soon and recently done; search and filters work", async ({ page }) => {
    await createItem(page, "AC service", { count: "6", unit: "month", lastDone: isoDaysAgo(200) });
    await createItem(page, "Toothbrush", { count: "3", unit: "month", lastDone: isoDaysAgo(86) });
    await createItem(page, "Plant food", { count: "2", unit: "week", lastDone: isoDaysAgo(1) });

    await page.goto("/dashboard");
    const attention = page.getByRole("region", { name: "Needs your attention" });
    await expect(attention.getByText("AC service")).toBeVisible();
    await expect(attention.getByText("Toothbrush")).toBeVisible();
    await expect(attention.getByText("Plant food")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Recently done" }).getByText("Plant food")).toBeVisible();

    await page.goto("/items");
    await page.getByRole("searchbox").fill("tooth");
    await expect(page.getByText("1 result")).toBeVisible();
    await page.getByRole("searchbox").fill("");
    await page.locator("#items-status").selectOption("overdue");
    await expect(page).toHaveURL(/status=overdue/);
    await expect(page.getByText("AC service")).toBeVisible();
    await expect(page.getByText("Plant food")).toHaveCount(0);
  });

  test("calendar export and QR downloads", async ({ page }) => {
    const id = await createItem(page, "Car oil", { count: "5", unit: "month", lastDone: isoDaysAgo(10) });

    const [ics] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Add to calendar" }).click()]);
    expect(ics.suggestedFilename()).toMatch(/^timora-\d{4}-\d{2}-\d{2}\.ics$/);
    const content = await readFile((await ics.path())!, "utf8");
    expect(content).toContain("BEGIN:VCALENDAR");
    expect(content).toContain("SUMMARY:Car oil");
    expect(content.replace(/\r\n /g, "")).toContain(`/items/${id}`);
    expect(content).toContain("BEGIN:VALARM");

    const png = await page.request.get(`/api/items/${id}/qr?format=png`);
    expect(png.headers()["content-type"]).toBe("image/png");
    const svg = await page.request.get(`/api/items/${id}/qr?format=svg`);
    expect(await svg.text()).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);

    await page.goto(`/items/${id}/label`);
    await expect(page.getByRole("img", { name: /QR code that opens “Car oil”/ })).toBeVisible();
  });

  test("regenerating the QR code invalidates the old link", async ({ page }) => {
    const id = await createItem(page, "Fire extinguisher");
    const scanUrl = await getScanUrl(page, id);
    await page.goto(scanUrl);
    await expect(page).toHaveURL(new RegExp(`/items/${id}\\?from=qr`));
    await expect(page.getByText("You opened this item from its QR code.")).toBeVisible();

    await page.getByRole("button", { name: "Issue a new code" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Issue a new code" }).click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "New code issued" })).toBeVisible();
    const newScanUrl = await getScanUrl(page, id);
    expect(newScanUrl).not.toBe(scanUrl);

    const old = await page.goto(scanUrl);
    expect(old?.status()).toBe(404);
  });

  test("settings change language, time zone and theme", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("radio", { name: "Dark" }).check({ force: true });
    await page.getByRole("radio", { name: "العربية" }).check({ force: true });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("heading", { level: 1, name: "الإعدادات" })).toBeVisible();
  });
});

/** Reads the current QR token as the signed-in user (through RLS) and returns the scan path. */
async function getScanUrl(page: Page, id: string): Promise<string> {
  return `/q/${await readOwnColumn(page.context(), "items", id, "qr_token")}`;
}
