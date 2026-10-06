import { expect, test, type Page } from "@playwright/test";
import { AUTH, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";
import { gym } from "./brand";
import { SECOND_LOCATION } from "../../prisma/seed-fixtures";

// D-125 to D-129. The demo has two locations: the main one, named after the
// config address, and a second one with its own classes, stock and desk.
const MAIN = gym.business.address.suburb;
const SECOND = SECOND_LOCATION.name;

async function chooseLocation(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Location" }).first().selectOption({ label: name });
}

test.describe("locations, as the owner", () => {
  test.use({ storageState: AUTH.owner });

  test("lists the locations, and adds and archives one", async ({ page }, info) => {
    await page.goto("/admin/locations");
    await expect(page.getByRole("heading", { name: "Locations", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: MAIN })).toBeVisible();
    await expect(page.getByRole("heading", { name: SECOND })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "locations");

    // Each run (desktop, then mobile) adds its own, then archives it.
    const name = `Pop-up ${info.project.name}`;
    await page.getByRole("button", { name: "Add location" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await dialog.getByLabel("Code", { exact: true }).fill(`popup-${info.project.name}`);
    await dialog.getByLabel("Suburb").fill("Parramatta");
    await dialog.getByLabel("State").selectOption("NSW");
    await dialog.getByLabel("Postcode").fill("2150");
    await dialog.getByRole("button", { name: "Add location" }).click();
    await expect(page.getByText(`${name} added`)).toBeVisible();
    // The location filter picks it up straight away.
    await expect(page.getByRole("combobox", { name: "Location" }).first().locator("option", { hasText: name })).toHaveCount(1);

    const card = page.getByRole("article", { name });
    await card.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText(`${name} archived`)).toBeVisible();
    await expect(card.getByText("Archived")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Location" }).first().locator("option", { hasText: name })).toHaveCount(0);
  });

  test("filters classes by location, and reports takings per location and combined", async ({ page }) => {
    await page.goto("/admin/classes");
    await expect(page.getByText("Kettlebells").first()).toBeVisible();
    await chooseLocation(page, SECOND);
    await expect(page.getByText("Kettlebells").first()).toBeVisible();
    await expect(page.getByText("Strongman")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await screenshot(page, "classes-by-location");

    // The choice is remembered on this device.
    await page.goto("/admin/finance");
    await expect(page.getByRole("combobox", { name: "Location" }).first()).toHaveValue(SECOND_LOCATION.id);
    await expect(page.getByText(`at ${SECOND}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Takings by location" })).toHaveCount(0);

    await chooseLocation(page, "All locations");
    await expect(page.getByRole("heading", { name: "Takings by location" })).toBeVisible();
    // Each location's bar is labelled with its name and number of payments.
    await expect(page.getByText(new RegExp(`^${MAIN} \\(\\d+\\)$`))).toBeVisible();
    await expect(page.getByText(new RegExp(`^${SECOND} \\(\\d+\\)$`))).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "finance-by-location");
  });

  test("sets which locations a plan covers", async ({ page }) => {
    await page.goto("/admin/plans");
    await expect(page.getByText("Access: Home location only").filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Edit Off-peak" }).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radio", { name: "Their home location only" })).toBeChecked();
    await dialog.getByRole("radio", { name: "Chosen locations" }).check();
    await expect(dialog.getByRole("group", { name: "Chosen locations" })).toBeVisible();
    await expectNoA11yViolations(page);
    await screenshot(page, "plan-locations");
    await dialog.getByRole("button", { name: "Cancel" }).click();
  });
});

test.describe("locations, as a desk at the second location", () => {
  test.use({ storageState: AUTH.deskSecond });

  test("works at that location only", async ({ page }) => {
    await page.goto("/admin/check-in");
    // One location: no filter to choose from.
    await expect(page.getByRole("heading", { name: "Check-in", level: 1 })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Location" })).toHaveCount(0);

    // An off-peak member's plan covers their home location only.
    await page.getByLabel("Pass, member ID or email").fill("ngaio.tipene@example.com");
    await page.getByRole("button", { name: "Check in" }).click();
    await expect(page.getByText("Not allowed in: Membership doesn't include this location")).toBeVisible();

    // A member on a plan that covers every location gets in.
    await page.getByLabel("Pass, member ID or email").fill("charlotte.pham@example.com");
    await page.getByRole("button", { name: "Check in" }).click();
    await expect(page.getByText("Come on in")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "check-in-second-location");

    await page.goto("/admin/classes");
    await expect(page.getByText("Kettlebells").first()).toBeVisible();
    await expect(page.getByText("Strongman")).toHaveCount(0);
  });
});

test.describe("locations, as a member", () => {
  test.use({ storageState: AUTH.member });

  test("sees classes at every location their plan covers, and can narrow them", async ({ page }) => {
    await page.goto("/member/classes");
    await expect(page.getByRole("heading", { name: "Classes", level: 1 })).toBeVisible();
    const select = page.getByRole("combobox", { name: "Location" });
    await expect(select).toBeVisible();
    await expect(page.getByText(`at ${SECOND}`).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "member-classes-locations");

    await select.selectOption({ label: MAIN });
    await expect(page.getByText(`at ${SECOND}`)).toHaveCount(0);
  });
});
