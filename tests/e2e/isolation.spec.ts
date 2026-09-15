import { expect, test } from "@playwright/test";
import { accessToken, createItem, isoDaysAgo, PASSWORD, readOwnColumn, setLocale, signIn, signUp, uniqueEmail } from "./helpers";

/**
 * Two separate accounts prove that one user can never see, change or reach another
 * user's items — through pages, downloads, QR scans or direct REST calls.
 */
test("users are fully isolated from each other", async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  await setLocale(aliceContext, "en");
  await setLocale(bobContext, "en");
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  const aliceEmail = uniqueEmail("alice");
  await signUp(alice, aliceEmail);
  const itemId = await createItem(alice, "Alice passport renewal", { count: "10", unit: "year", lastDone: isoDaysAgo(30) });
  const token = await readOwnColumn(aliceContext, "items", itemId, "qr_token");

  await signUp(bob, uniqueEmail("bob"));

  // Pages
  for (const path of [`/items/${itemId}`, `/items/${itemId}/edit`, `/items/${itemId}/history`, `/items/${itemId}/label`]) {
    const response = await bob.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(bob.getByText("Alice passport renewal")).toHaveCount(0);
  }

  // Lists
  await bob.goto("/items");
  await expect(bob.getByText("Alice passport renewal")).toHaveCount(0);

  // Downloads
  expect((await bob.request.get(`/api/items/${itemId}/calendar`)).status()).toBe(404);
  expect((await bob.request.get(`/api/items/${itemId}/qr?format=svg`)).status()).toBe(404);

  // QR scan of another user's label looks exactly like an unknown code
  const scan = await bob.goto(`/q/${token}`);
  expect(scan?.status()).toBe(404);
  await expect(bob).not.toHaveURL(new RegExp(itemId));

  // Direct REST access with Bob's own session is filtered or rejected by RLS
  await expect(readOwnColumn(bobContext, "items", itemId, "name")).rejects.toThrow(/not visible/);

  // Alice still sees her item, and her QR link works after signing in again
  await alice.goto(`/items/${itemId}`);
  await expect(alice.getByRole("heading", { level: 1, name: "Alice passport renewal" })).toBeVisible();
  await aliceContext.clearCookies();
  await setLocale(aliceContext, "en");
  await alice.goto(`/q/${token}`);
  await expect(alice).toHaveURL(/\/sign-in\?next=/);
  await signIn(alice, aliceEmail, PASSWORD);
  await expect(alice).toHaveURL(new RegExp(`/items/${itemId}\\?from=qr`));

  await aliceContext.close();
  await bobContext.close();
});

test("direct API calls with another account cannot record completions or edit an item", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  await setLocale(ownerContext, "en");
  await setLocale(otherContext, "en");
  const owner = await ownerContext.newPage();
  const other = await otherContext.newPage();

  await signUp(owner, uniqueEmail("owner"));
  const itemId = await createItem(owner, "Owner water filter", { count: "3", unit: "month", lastDone: isoDaysAgo(5) });
  await signUp(other, uniqueEmail("other"));

  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${await accessToken(otherContext)}`,
    apikey: "local-fake-publishable-key-0000",
    prefer: "return=representation",
  };

  const insert = await fetch("http://127.0.0.1:54321/rest/v1/completion_records", {
    method: "POST",
    headers,
    body: JSON.stringify({ item_id: itemId, completed_on: isoDaysAgo(0), source: "done_now" }),
  });
  expect(insert.ok).toBe(false);

  const patch = await fetch(`http://127.0.0.1:54321/rest/v1/items?id=eq.${itemId}&select=id`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ name: "hacked" }),
  });
  expect(await patch.json()).toEqual([]);

  const remove = await fetch(`http://127.0.0.1:54321/rest/v1/items?id=eq.${itemId}&select=id`, { method: "DELETE", headers });
  expect(await remove.json()).toEqual([]);

  await owner.goto(`/items/${itemId}`);
  await expect(owner.getByRole("heading", { level: 1, name: "Owner water filter" })).toBeVisible();
  await expect(owner.getByText("Completed once")).toBeVisible();

  await ownerContext.close();
  await otherContext.close();
});
