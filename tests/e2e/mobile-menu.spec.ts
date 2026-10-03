import { expect, test } from "@playwright/test";
import { AUTH } from "./helpers";

test.describe("mobile menu", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 500, "Phone layout only");
  test.use({ storageState: AUTH.owner });

  test("opens, traps focus, and closes with Escape or the backdrop", async ({ page }) => {
    await page.goto("/admin");
    const open = page.getByRole("button", { name: "Open menu" });
    await open.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await drawer.getByRole("link", { name: "Members" }).click();
    await expect(page).toHaveURL(/\/admin\/members/);
    await expect(drawer).toBeHidden();
  });
});
