import { expect, test } from "@playwright/test";
import { AUTH, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";

test.describe("as the owner", () => {
  test.use({ storageState: AUTH.owner });

  test("dashboard shows today's numbers", async ({ page }) => {
    await page.goto("/admin");
    const board = page.getByRole("region", { name: "Today's numbers" });
    await expect(board.getByText("Active members")).toBeVisible();
    await expect(board.getByText("Monthly revenue (est.)")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "admin-dashboard");
  });

  test("members: search and open a profile", async ({ page }) => {
    await page.goto("/admin/members");
    await expect(page.getByRole("heading", { name: "Members", level: 1 })).toBeVisible();
    await page.getByLabel("Search members").fill("kowalski");
    const row = page.getByRole("link", { name: "Daniel Kowalski" }).filter({ visible: true }).first();
    await expect(row).toBeVisible();
    await expect(page.getByRole("link", { name: "Charlotte Pham" }).filter({ visible: true })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await page.getByLabel("Search members").fill("");
    await expect(page.getByRole("link", { name: "Charlotte Pham" }).filter({ visible: true }).first()).toBeVisible();
    await screenshot(page, "admin-members");
    await page.getByRole("link", { name: "Daniel Kowalski" }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "Daniel Kowalski" })).toBeVisible();
    await expect(page.getByText("Asked about pausing over summer.")).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "admin-member-detail");
  });

  test("classes, payments, retention and settings pass accessibility checks", async ({ page }) => {
    for (const [path, heading, shot] of [
      ["/admin/classes", "Classes", "admin-classes"],
      ["/admin/billing", "Payments", "admin-payments"],
      ["/admin/retention", "Retention", "admin-retention"],
      ["/admin/settings", "Settings", "admin-settings"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalScroll(page);
      await expectNoA11yViolations(page);
      await screenshot(page, shot);
    }
  });

  test("add member dialog is keyboard accessible and reports errors", async ({ page }) => {
    await page.goto("/admin/members");
    await page.getByRole("button", { name: "Add member" }).click();
    const dialog = page.getByRole("dialog", { name: "Add member" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Full name")).toBeFocused();
    await expectNoA11yViolations(page);
    await dialog.getByLabel("Full name").fill("Test Person");
    await dialog.getByLabel("Email").fill("charlotte.pham@example.com");
    await dialog.getByRole("button", { name: "Add member" }).click();
    await expect(dialog.getByText("Already in use")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Add member" })).toBeFocused();
  });
});

test.describe("as front desk", () => {
  test.use({ storageState: AUTH.frontdesk });

  test("sees members but not their private details, and can't add members (D-100, D-105)", async ({ page }) => {
    await page.goto("/admin/members");
    await expect(page.getByRole("link", { name: "Charlotte Pham" }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add member" })).toHaveCount(0);
    await expect(page.getByText("charlotte.pham@example.com")).toHaveCount(0);
    await page.getByRole("link", { name: "Daniel Kowalski" }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "Daniel Kowalski" })).toBeVisible();
    await expect(page.getByText("Asked about pausing over summer.")).toHaveCount(0);
    await expectNoA11yViolations(page);
  });

  test("checks a member in, and refuses a past-due member", async ({ page }) => {
    await page.goto("/admin/check-in");
    const input = page.getByLabel("Pass, member ID or email");
    await expect(input).toBeFocused();
    await input.fill("priya.sharma@example.com");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Come on in")).toBeVisible();
    // Overdue 2 days: inside the 7-day grace period, let in with a warning.
    await input.fill("mitchell.greaves@example.com");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Payment overdue. Ask them to update their card.")).toBeVisible();
    // Overdue 9 days: refused.
    await input.fill("riley.dunstan@example.com");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Not allowed in: Payment overdue")).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "admin-check-in");
  });

  test("can't reach staff management, change roles or prices", async ({ page }) => {
    expect((await page.request.get("/api/staff")).status()).toBe(403);
    expect((await page.request.get("/api/audit-log")).status()).toBe(403);
    expect((await page.request.post("/api/roles", { data: { name: "Sneaky", permissions: ["finance.view"] } })).status()).toBe(403);
    await page.goto("/admin/plans");
    await expect(page.getByText("Only admins can change this")).toBeVisible();
    await expect(page.getByRole("button", { name: /New plan/ })).toHaveCount(0);
  });
});

test.describe("as a trainer", () => {
  test.use({ storageState: AUTH.trainer });

  test("doesn't see money or staff admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: "Payments" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Finance" })).toHaveCount(0);
    expect((await page.request.get("/api/payments")).status()).toBe(403);
    expect((await page.request.get("/api/members")).status()).toBe(403);
    await expect(page.getByRole("link", { name: "Members" })).toHaveCount(0);
  });
});
