import { expect, test } from "@playwright/test";
import { AUTH, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";
import { gym } from "./brand";

test("public home shows plans with GST-inclusive prices and opening hours", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(gym.brand.name);
  await expect(page.getByText("Prices include GST.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unlimited" })).toBeVisible();
  await expect(page.getByText(`ABN ${gym.business.abn}`)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await screenshot(page, "home");
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/member");
  await expect(page).toHaveURL(/\/login\?next=%2Fmember/);
  await expectNoA11yViolations(page);
  await screenshot(page, "member-login");
});

test("old staff URLs redirect to the new console", async ({ page }) => {
  await page.goto("/members");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fmembers/);
});

test.describe("as a member", () => {
  test.use({ storageState: AUTH.member });

  test("sees only their own membership", async ({ page }) => {
    await page.goto("/member");
    await expect(page.getByRole("heading", { name: "Hi Charlotte" })).toBeVisible();
    await expect(page.getByText("Unlimited, $39.95 per week")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "member-home");
  });

  test("can't open the staff console or staff APIs", async ({ page }) => {
    await page.goto("/admin/members");
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await page.request.get("/api/members")).status()).toBe(401);
    expect((await page.request.get("/api/dashboard/stats")).status()).toBe(401);
  });
});
