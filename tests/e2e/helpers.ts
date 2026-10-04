import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DEMO_PASSWORD } from "../../prisma/demo";

export { DEMO_PASSWORD };

export const AUTH = {
  owner: "tests/e2e/.auth/owner.json",
  frontdesk: "tests/e2e/.auth/frontdesk.json",
  trainer: "tests/e2e/.auth/trainer.json",
  member: "tests/e2e/.auth/member.json",
} as const;

export async function signInStaff(page: Page, email = "owner@example.com") {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

export async function signInMember(page: Page, email = "charlotte.pham@example.com") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
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
