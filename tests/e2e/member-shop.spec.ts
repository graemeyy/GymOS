import { expect, test, type Page } from "@playwright/test";
import { AUTH, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";
import { seededTee } from "./brand";

// Signed-in members shop inside the member app: the top bar and tab bar stay,
// with Shop as the current tab and the cart count on it. Signed-out visitors
// get the public site's header instead.

// On phones the tabs are a bar at the bottom; on wider screens they're in the
// top bar. Either way it's the "Member" navigation, and only one is showing.
const tabBar = (page: Page) => page.getByRole("navigation", { name: "Member" }).filter({ visible: true });

async function expectShopTab(page: Page, isMobile: boolean) {
  const nav = tabBar(page);
  await expect(nav).toHaveCount(1);
  if (isMobile) {
    // The bottom bar, within thumb reach.
    const box = await nav.boundingBox();
    expect(box!.y + box!.height).toBeGreaterThan((page.viewportSize()?.height ?? 0) - 2);
  }
  for (const tab of ["Home", "Classes", "Pass", "Account"]) await expect(nav.getByRole("link", { name: tab })).toBeVisible();
  // "Shop", or "Shop, 1 item in cart" once something's in the cart.
  await expect(nav.getByRole("link", { name: /^Shop(, \d+ items? in cart)?$/ })).toHaveAttribute("aria-current", "page");
}

test.describe("shop, signed in as a member", () => {
  test.use({ storageState: AUTH.member });

  test("keeps the member tab bar on the shop, product and cart pages, with the cart count on Shop", async ({ page, isMobile }) => {
    // Start from an empty cart on this device.
    await page.goto("/shop");
    await page.evaluate(() => window.localStorage.removeItem("gymos-cart-v1"));
    await page.reload();

    await expect(page.getByRole("heading", { name: "Shop", level: 1 })).toBeVisible();
    await expectShopTab(page, isMobile);
    await expect(tabBar(page).getByTestId("cart-badge")).toHaveCount(0);
    // The public header's sign-in button isn't here: this is the member app.
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "member-shop");

    await page.goto(`/shop/${seededTee.slug}`);
    await expect(page.getByRole("heading", { name: seededTee.name, level: 1 })).toBeVisible();
    await expectShopTab(page, isMobile);
    await page.getByRole("button", { name: "Add to cart" }).click();
    // The badge on the Shop tab counts what's in the cart, and says so to screen readers.
    await expect(tabBar(page).getByTestId("cart-badge")).toHaveText("1");
    await expect(tabBar(page).getByRole("link", { name: "Shop, 1 item in cart" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "member-shop-product");

    await page.goto("/shop/cart");
    await expect(page.getByRole("heading", { name: /cart/i, level: 1 })).toBeVisible();
    await expectShopTab(page, isMobile);
    await expect(tabBar(page).getByTestId("cart-badge")).toHaveText("1");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "member-shop-cart");

    // The tab bar still goes everywhere in the member app from here.
    await tabBar(page).getByRole("link", { name: "Classes" }).click();
    await expect(page).toHaveURL(/\/member\/classes$/);

    await page.evaluate(() => window.localStorage.removeItem("gymos-cart-v1"));
  });
});

test.describe("shop, signed out", () => {
  test("keeps the public layout, without the member tab bar", async ({ page }) => {
    for (const path of ["/shop", `/shop/${seededTee.slug}`, "/shop/cart"]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: "Member" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
    }
  });
});
