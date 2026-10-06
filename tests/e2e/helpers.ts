import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// tests/e2e/global-setup.ts seeds the throwaway database with a random
// password each run (D-110). Seeded accounts must replace it at first sign-in
// (D-111); auth.setup.ts does that once per account, choosing
// accountPassword(), which every other test then uses.
export const seedPassword = () => required("E2E_SEED_PASSWORD");
export const accountPassword = () => required("E2E_PASSWORD");

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is set by tests/e2e/global-setup.ts; run the suite with npx playwright test.`);
  return value;
}

export const AUTH = {
  owner: "tests/e2e/.auth/owner.json",
  frontdesk: "tests/e2e/.auth/frontdesk.json",
  trainer: "tests/e2e/.auth/trainer.json",
  deskSecond: "tests/e2e/.auth/deskSecond.json",
  member: "tests/e2e/.auth/member.json",
} as const;

// The first sign-in of a seeded account: the seed password, then the
// "Choose a new password" screen, then the app.
export async function firstSignIn(page: Page, kind: "staff" | "member", email: string) {
  await page.goto(kind === "staff" ? "/admin/login" : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(seedPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.getByLabel("Current password").fill(seedPassword());
  await page.getByLabel("New password", { exact: true }).fill(accountPassword());
  await page.getByLabel("New password again").fill(accountPassword());
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeHidden();
}

export async function signInStaff(page: Page, email = "owner@example.com") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(accountPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

export async function signInMember(page: Page, email = "charlotte.pham@example.com") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(accountPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/member$/);
}

// Zero axe violations, WCAG 2.1 A and AA rules.
export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`);
  expect(summary, summary.join("\n")).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

export async function screenshot(page: Page, name: string) {
  const width = page.viewportSize()?.width ?? 0;
  if (process.env.E2E_SCREENSHOTS) {
    const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 2400);
    await page.screenshot({ path: `docs/screenshots/${name}-${width}.jpg`, type: "jpeg", quality: 72, fullPage: true, clip: { x: 0, y: 0, width, height } });
  }
}
