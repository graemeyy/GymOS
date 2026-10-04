import { expect, test } from "@playwright/test";
import { AUTH, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";

test.describe("roles and staff, as the owner", () => {
  test.use({ storageState: AUTH.owner });

  test("roles page: the matrix toggles a permission and the audit log keeps old and new values", async ({ page }) => {
    await page.goto("/admin/roles");
    await expect(page.getByRole("heading", { name: "Roles", level: 1 })).toBeVisible();
    // Phones show one role at a time.
    if (test.info().project.name === "mobile") await page.getByRole("combobox", { name: "Role" }).selectOption({ label: "Trainer" });
    const box = page.getByRole("checkbox", { name: "Trainer: Send announcements" }).filter({ visible: true }).first();
    await expect(box).not.toBeChecked();
    if (test.info().project.name === "desktop") await expect(page.getByRole("checkbox", { name: "Owner: Send announcements" }).filter({ visible: true }).first()).toBeDisabled();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "admin-roles");

    await box.click();
    await expect(page.getByText("Trainer can now: send announcements")).toBeVisible();
    await expect(box).toBeChecked();
    await box.click();
    await expect(box).not.toBeChecked();
    await expect(page.getByText("Trainer can no longer: send announcements")).toBeVisible();

    await page.goto("/admin/audit");
    await page.getByLabel("Area").selectOption({ label: "Roles and permissions" });
    await page.getByText("1 change").filter({ visible: true }).first().click();
    await expect(page.getByText("announcements.send").filter({ visible: true }).first()).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("invite someone, they set a password from the link, then deactivate them", async ({ page, browser }) => {
    const email = `invitee-${Date.now()}-${test.info().project.name}@example.com`;
    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "Staff", level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
    await expectNoA11yViolations(page);
    await screenshot(page, "admin-staff");

    await page.getByRole("button", { name: "Invite staff" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite staff" });
    await dialog.getByLabel("Full name").fill("Invited Person");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Role").selectOption({ label: "Trainer" });
    await dialog.getByRole("button", { name: "Send invitation" }).click();
    // No email in the test environment, so the link is shown to pass on.
    const link = await page.getByRole("textbox", { name: "Invitation link" }).inputValue();
    expect(link).toContain("/admin/invite?token=");
    await page.getByRole("button", { name: "Done" }).click();

    const guest = await browser.newContext();
    const invitee = await guest.newPage();
    await invitee.goto(link);
    await expect(invitee.getByText("Welcome, Invited Person.")).toBeVisible();
    await expectNoA11yViolations(invitee);
    await invitee.getByLabel("Password", { exact: true }).fill("a-long-new-password");
    await invitee.getByLabel("Password again").fill("a-long-new-password");
    await invitee.getByRole("button", { name: "Set password and sign in" }).click();
    await expect(invitee).toHaveURL(/\/admin$/);
    expect(await (await invitee.request.get("/api/auth/me")).json()).toMatchObject({ name: "Invited Person", roleName: "Trainer" });
    // The link only works once.
    await invitee.goto(link);
    await expect(invitee.getByRole("heading", { name: "Invitation not valid" })).toBeVisible();

    await page.reload();
    // A table row on desktop, a list item on phones.
    const row = page.locator("tr, li").filter({ hasText: email }).filter({ visible: true }).first();
    await row.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Deactivate account" }).click();
    await expect(page.getByText("Invited Person is deactivated and signed out")).toBeVisible();
    expect((await invitee.request.get("/api/auth/me")).status()).toBe(401);
    await guest.close();
  });
});
