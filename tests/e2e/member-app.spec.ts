import { expect, test } from "@playwright/test";
import { AUTH, accountPassword, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";
import { gym, seededTee } from "./brand";

test("a new member signs up, accepts the terms and chooses to pay at the front desk", async ({ page }, info) => {
  const email = `e2e-${info.project.name}-${Date.now()}@example.com`;
  await page.goto("/signup?plan=standard");
  await expectNoA11yViolations(page);
  await screenshot(page, "p3-signup");
  await page.getByLabel("Your name").fill("Robin Example");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-e2e-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Please accept the membership terms and privacy policy")).toBeVisible();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/member\/welcome\?plan=standard/);
  await expect(page.getByRole("heading", { name: "Welcome, Robin" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Standard/ })).toBeChecked();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await screenshot(page, "p3-welcome");

  // Paying online waits for the email to be confirmed (D-114).
  await expect(page.getByRole("region", { name: "Confirm your email" })).toBeVisible();
  await page.getByRole("button", { name: "Pay by card" }).click();
  await expect(page.getByText(/Confirm your email address before paying online/)).toBeVisible();
  await page.getByRole("button", { name: "I'll pay at the front desk" }).click();
  await expect(page).toHaveURL(/\/member$/);
  await expect(page.getByText("Not started")).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose a membership" })).toBeVisible();
});

test.describe("as a member", () => {
  test.use({ storageState: AUTH.member });

  test("cancels and rebooks a class", async ({ page }) => {
    await page.goto("/member/classes");
    await expect(page.getByRole("heading", { name: "Classes", level: 1 })).toBeVisible();
    // The same class can be booked on more than one day this week, depending
    // on today's date, so everything below stays inside one day's list.
    const firstDay = page.getByRole("region").filter({ has: page.getByRole("button", { name: /^Cancel booking for / }) }).first();
    const dayName = (await firstDay.getByRole("heading").first().textContent())!.trim();
    const day = page.getByRole("region", { name: dayName, exact: true });
    const cancel = day.getByRole("button", { name: /^Cancel booking for / }).first();
    const label = (await cancel.getAttribute("aria-label"))!.replace("Cancel booking for ", "");
    await cancel.click();
    await expect(page.getByText(/Booking cancelled/)).toBeVisible();
    await day.getByRole("button", { name: `Book ${label}` }).click();
    await expect(page.getByText(`Booked: ${label}.`)).toBeVisible();
    await expect(day.getByRole("button", { name: `Cancel booking for ${label}` })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p3-classes");
  });

  test("shows a QR pass", async ({ page }) => {
    await page.goto("/member/pass");
    await expect(page.getByRole("img", { name: "Check-in QR code for Charlotte Pham" })).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "p3-pass");
  });

  test("membership page shows the owner's rules and opens the pause form", async ({ page }) => {
    await page.goto("/member/membership");
    await expect(page.getByRole("heading", { name: "Change plan" })).toBeVisible();
    await expect(page.getByText(/14 days' notice/)).toBeVisible();
    await expect(page.getByRole("link", { name: /^Invoice INV-/ }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p3-membership");
    await page.getByRole("button", { name: "Pause my membership" }).click();
    const dialog = page.getByRole("dialog", { name: "Pause my membership" });
    await expect(dialog).toBeVisible();
    await expectNoA11yViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("opens a tax invoice", async ({ page }) => {
    await page.goto("/member/membership");
    await page.getByRole("link", { name: /^Invoice INV-/ }).first().click();
    await expect(page.getByRole("heading", { name: "Tax invoice" })).toBeVisible();
    await expect(page.getByText(`ABN ${gym.business.abn}`)).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("account page: preferences, data export, and deletion blocked while active", async ({ page }) => {
    await page.goto("/member/account");
    await expect(page.getByRole("switch", { name: "Gym news" })).toBeVisible();
    await expect(page.getByText("Cancel your membership first.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete my account" })).toBeDisabled();
    const exported = await page.request.get("/api/me/export");
    expect(exported.status()).toBe(200);
    expect(await exported.json()).toMatchObject({ email: "charlotte.pham@example.com" });
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p3-account");
  });

  test("shop: member price, cart with discount and GST, and checkout needs Stripe", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByText("Your 10% member discount is already taken off.")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p3-shop");

    await page.getByRole("link", { name: new RegExp(seededTee.name) }).click();
    await expect(page.getByText("$31.50")).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "p3-product");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.getByRole("link", { name: "View cart" }).click();

    await expect(page.getByText("Member discount (10%)")).toBeVisible();
    await expect(page.getByText("Includes GST")).toBeVisible();
    await page.getByText("Deliver", { exact: true }).click();
    await expect(page.getByLabel("Postcode")).toBeVisible();
    await expect(page.getByText("$10.00")).toBeVisible();
    await page.getByText("Pick up at the gym", { exact: true }).click();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p3-cart");
    await page.getByRole("button", { name: /^Pay \$/ }).click();
    await expect(page.getByText(/Payments aren't set up yet/)).toBeVisible();
  });

  test("order history and order detail", async ({ page }) => {
    await page.goto("/member/orders");
    await page.getByRole("link", { name: /^Order \d+/ }).first().click();
    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Tax invoice INV-/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p3-order");
  });
});

test("signed-out shoppers are asked to sign in to pay, and come back to the cart", async ({ page }) => {
  await page.goto(`/shop/${seededTee.slug}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.goto("/shop/cart");
  await page.getByRole("link", { name: "Sign in to pay" }).click();
  await expect(page).toHaveURL(/\/login\?next=\/shop\/cart/);
  await page.getByLabel("Email").fill("jack.osullivan@example.com");
  await page.getByLabel("Password").fill(accountPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/shop\/cart$/);
  await expect(page.getByText("Member discount (5%)")).toBeVisible();
});

test("terms and privacy are marked as templates needing a lawyer", async ({ page }) => {
  for (const path of ["/terms", "/privacy"]) {
    await page.goto(path);
    await expect(page.getByText(/Template only/)).toBeVisible();
    await expectNoA11yViolations(page);
  }
  await page.goto("/terms");
  await expect(page.getByText(/can't be excluded under the Australian Consumer Law/)).toBeVisible();
  await screenshot(page, "p3-terms");
});

test("installable: manifest, icons and service worker", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ start_url: "/member", display: "standalone" });
  const icon = await request.get("/pwa-icon/192");
  expect(icon.headers()["content-type"]).toContain("image/png");
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-cache");
});
