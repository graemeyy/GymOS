import { expect, test, type Page } from "@playwright/test";
import { AUTH, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";
import { gym } from "./brand";

// D-124: the owner rebrands the app from the Branding page, without code.
test.describe("branding", () => {
  test.use({ storageState: AUTH.owner });

  async function restoreDefaults(page: Page) {
    const res = await page.request.get("/api/branding");
    const current = (await res.json()) as Record<string, unknown>;
    const { logoUrl: _l, iconUrl: _i, ...form } = current;
    await page.request.put("/api/branding", {
      data: { ...form, name: gym.brand.name, appName: gym.brand.shortName, primaryColour: gym.brand.primaryColour, accentColour: gym.brand.accentColour, displayFont: gym.brand.displayFont },
    });
  }

  test.afterEach(async ({ page }) => restoreDefaults(page));

  test("changes the name, colours and fonts with a live preview and contrast checks", async ({ page }) => {
    await page.goto("/admin/branding");
    await expect(page.getByRole("heading", { name: "Branding", level: 1 })).toBeVisible();
    const preview = page.getByRole("group", { name: "Preview" });
    await expect(preview.getByText(gym.brand.name).first()).toBeVisible();
    await expect(page.getByText("All colour pairs are readable")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "branding");

    // A main colour too light for text: the checks say so and saving is refused.
    await page.getByLabel("Main colour", { exact: true }).fill("#F2C230");
    await expect(page.getByText(/colour pairs? (isn't|aren't) readable enough/)).toBeVisible();
    await page.getByRole("button", { name: "Save branding" }).click();
    await expect(page.getByText(/Links and outlines on the page \(light mode\): [\d.]+:1, needs 4\.5:1/).first()).toBeVisible();

    // A readable rebrand saves, and the console picks it up.
    await page.getByLabel("Main colour", { exact: true }).fill("#7A1F3D");
    await page.getByLabel("Gym name").fill("Harbour Lift Club");
    await page.getByLabel("App name").fill("Harbour");
    await page.getByLabel("Headings").selectOption("oswald");
    await expect(preview.getByText("Harbour Lift Club").first()).toBeVisible();
    await page.getByRole("button", { name: "Save branding" }).click();
    await expect(page.getByText("Branding saved")).toBeVisible();
    await expect.poll(() => page.locator("#brand-tokens").evaluate((el) => el.textContent ?? "")).toMatch(/--plate:122 31 61/);
    await expect(page.getByText("Harbour", { exact: true }).locator("visible=true").first()).toBeVisible();

    // The public site and the installed app follow.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harbour Lift Club");
    const manifest = await (await page.request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ short_name: "Harbour", theme_color: "#7A1F3D" });
    expect((await page.request.get("/pwa-icon/192")).headers()["content-type"]).toBe("image/png");
    await screenshot(page, "branding-home-rebranded");
  });
});

test.describe("branding for staff without branding.edit", () => {
  test.use({ storageState: AUTH.frontdesk });

  test("isn't in the menu or reachable without branding.edit", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("navigation", { name: "Staff" }).getByRole("link", { name: "Branding" })).toHaveCount(0);
    expect((await page.request.get("/api/branding")).status()).toBe(403);
  });
});
