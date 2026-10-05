import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";

// D-112, D-113. Email isn't set up in the tests, so the server shows each
// single-use link on screen (SHOW_EMAIL_LINKS, D-115). Every test runs at
// 1440px (desktop) and 375px (mobile).

// The reset limits are per address (5 requests per 15 minutes), and every
// test comes from localhost, so each test gets its own forwarded address.
test.beforeEach(async ({ page }) => {
  const part = () => Math.floor(Math.random() * 250) + 1;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${part()}.${part()}.${part()}` });
});

async function requestResetLink(page: Page, signInPath: string, email: string) {
  await page.goto(signInPath);
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "account, we" })).toContainText(`If ${email} has a`);
  return page.getByRole("link", { name: "Open the reset link" });
}

async function chooseNewPassword(page: Page, password: string) {
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("New password again").fill(password);
  await page.getByRole("button", { name: "Save new password" }).click();
}

test("a member resets a forgotten password from the emailed link and is signed in", async ({ page }) => {
  const link = await requestResetLink(page, "/login", "oliver.brandt@example.com");
  await screenshot(page, "forgot-password");
  await link.click();
  await chooseNewPassword(page, `reset-${Date.now()}-member`);
  await screenshot(page, "reset-password");
  // Oliver signed up online and hasn't chosen a plan, so he lands on the welcome steps.
  await expect(page).toHaveURL(/\/member(\/welcome)?$/);
  await expect(page.getByRole("heading", { name: /Welcome, Oliver/ })).toBeVisible();
  // The link proved he reads that inbox, so there's nothing left to confirm.
  await expect(page.getByRole("region", { name: "Confirm your email" })).toHaveCount(0);
});

test("a staff member resets their password and goes straight to the console", async ({ page }) => {
  const link = await requestResetLink(page, "/admin/login", "admin@example.com");
  await link.click();
  await chooseNewPassword(page, `reset-${Date.now()}-staff`);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("an email without an account gets the same answer and no link", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "account, we" })).toContainText("If nobody-here@example.com has a member account");
  await expect(page.getByRole("link", { name: "Open the reset link" })).toHaveCount(0);
});

test("a used reset link says so and offers a new one", async ({ page }) => {
  const link = await requestResetLink(page, "/admin/login", "manager@example.com");
  const href = (await link.getAttribute("href"))!;
  await link.click();
  await chooseNewPassword(page, `reset-${Date.now()}-again`);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto(href);
  await expect(page.getByText(/expired or was already used/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask for a new link" })).toBeVisible();
});

test("a new member confirms their email from the banner's link", async ({ page }, info) => {
  const email = `verify-${info.project.name}-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Casey Verify");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-e2e-password");
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/member\/welcome/);

  const banner = page.getByRole("region", { name: "Confirm your email" });
  await expect(banner).toContainText(email);
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await screenshot(page, "verify-email-banner");
  await banner.getByRole("button", { name: "Send the link again" }).click();
  await banner.getByRole("link", { name: "Open the confirmation link" }).click();

  await expect(page.getByRole("heading", { name: "Confirm your email" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await page.getByRole("button", { name: "Confirm my email address" }).click();
  await expect(page.getByText("Thanks. Your email address is confirmed.")).toBeVisible();
  await page.getByRole("link", { name: "Go to your membership" }).click();
  await expect(page.getByRole("region", { name: "Confirm your email" })).toHaveCount(0);
});
