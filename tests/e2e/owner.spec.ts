import { expect, test } from "@playwright/test";
import { AUTH, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";

test.describe("owner features", () => {
  test.use({ storageState: AUTH.owner });

  test("member profile: membership, benefits, notes and the pause dialog", async ({ page }) => {
    await page.goto("/admin/members");
    await page.getByLabel("Search members").fill("Jack");
    await page.getByRole("link", { name: "Jack O'Sullivan" }).first().click();
    await expect(page.getByRole("heading", { name: "Membership", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Benefits this cycle" })).toBeVisible();
    await expect(page.getByText("Class cancelled by the gym last week")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-member-profile");

    await page.getByRole("button", { name: "Pause" }).click();
    const dialog = page.getByRole("dialog", { name: "Pause membership" });
    await expect(dialog).toBeVisible();
    await expectNoA11yViolations(page);
    await page.keyboard.press("Escape");

    const note = `Asked about the student plan (${page.viewportSize()?.width}px run).`;
    await page.getByLabel("Add a note").fill(note);
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByText(note)).toBeVisible();
  });

  test("plans page lists tiers with benefits", async ({ page }) => {
    await page.goto("/admin/plans");
    await expect(page.getByRole("heading", { name: "Plans", level: 1 })).toBeVisible();
    await expect(page.getByText("Unlimited classes").filter({ visible: true }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-plans");
    await page.getByRole("button", { name: "Edit Standard" }).click();
    await expect(page.getByRole("dialog", { name: "Edit Standard" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("payments: overdue list, a payment, its refund dialog and tax invoice", async ({ page, context }) => {
    await page.goto("/admin/billing");
    await expect(page.getByRole("heading", { name: "Overdue payments" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Overdue payments" }).getByRole("link", { name: "Riley Dunstan" }).filter({ visible: true })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-payments");

    await page.getByRole("link", { name: "Charlotte Pham" }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: /^INV-\d{6}/ })).toBeVisible();
    await page.getByRole("button", { name: "Refund" }).click();
    await expect(page.getByRole("dialog", { name: "Refund this payment" })).toBeVisible();
    await expectNoA11yViolations(page);
    await page.keyboard.press("Escape");
    await screenshot(page, "p2-payment-detail");

    const [invoice] = await Promise.all([context.waitForEvent("page"), page.getByRole("link", { name: "Tax invoice" }).click()]);
    await expect(invoice.getByRole("heading", { name: "Tax invoice" })).toBeVisible();
    await expect(invoice.getByText("ABN 94 687 093 963")).toBeVisible();
    await expect(invoice.getByText("GST included")).toBeVisible();
    await expectNoA11yViolations(invoice);
    await screenshot(invoice, "p2-tax-invoice");
  });

  test("finance: GST summary, breakdowns and downloads", async ({ page }) => {
    await page.goto("/admin/finance");
    await expect(page.getByRole("heading", { name: "GST summary" })).toBeVisible();
    await expect(page.getByText("not tax advice").first()).toBeVisible();
    await page.getByLabel("Period").selectOption("financial-year");
    await expect(page.getByRole("heading", { name: "Memberships by plan" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-finance");
    const csv = await page.request.get("/api/finance/export?type=summary&period=financial-year");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("not tax advice");
  });

  test("shop: products, the supplement guideline, and the order queue", async ({ page }) => {
    await page.goto("/admin/shop");
    await expect(page.getByRole("heading", { name: "Whey protein isolate 1 kg" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-shop-products");

    await page.getByRole("link", { name: "Edit Whey protein isolate 1 kg" }).click();
    await expect(page.getByText("Before you list a supplement")).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-product-editor");

    await page.goto("/admin/shop/orders");
    await expect(page.getByRole("link", { name: /#\d+, Charlotte Pham/ }).filter({ visible: true }).first()).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-orders");
    // Seed data has two paid orders: the desktop run packs one, mobile the other.
    await page.getByLabel("Show").selectOption("PAID");
    await page.getByRole("link", { name: /#\d+, / }).filter({ visible: true }).first().click();
    await page.getByRole("button", { name: "Mark packed" }).click();
    await expect(page.getByText("Order packed")).toBeVisible();
    // Next step depends on the order: pickup orders go to "Ready for pickup", shipping orders to "Mark shipped".
    await expect(page.getByRole("button", { name: /Ready for pickup|Mark shipped/ })).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-order-detail");
  });

  test("classes: week view and weekly timetable", async ({ page }) => {
    await page.goto("/admin/classes/timetable");
    await expect(page.getByRole("heading", { name: "Weekly timetable" })).toBeVisible();
    await expect(page.getByText("Strongman Saturday")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-timetable");
    await page.getByRole("button", { name: "Add the next two weeks now" }).click();
    await expect(page.getByText(/Added \d+ class|already on the calendar/)).toBeVisible();
    await page.goto("/admin/classes");
    await page.getByRole("button", { name: "Next week" }).click();
    await expect(page.getByText("Next week")).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("announcements, audit log and settings", async ({ page }) => {
    await page.goto("/admin/announcements");
    await expect(page.getByRole("heading", { name: "Long weekend hours" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-announcements");

    await page.goto("/admin/audit");
    await page.getByLabel("Area").selectOption("order.");
    await expect(page.getByText(/order: status changed/i).filter({ visible: true }).first()).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-audit");

    await page.goto("/admin/settings");
    await expect(page.getByRole("heading", { name: "What each role can do" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your password" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });

  test("dashboard shows sign-ups, churn, check-ins and revenue by plan and product", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByText("Churn, 30 days")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check-ins this week" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revenue, last 30 days" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "p2-dashboard");
  });
});
