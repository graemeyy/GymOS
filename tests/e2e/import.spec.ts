import { expect, test, type Page } from "@playwright/test";
import { AUTH, expectNoA11yViolations, expectNoHorizontalScroll, screenshot } from "./helpers";

// D-130, D-131: the owner brings members across from another system.
test.use({ storageState: AUTH.owner });

async function chooseFile(page: Page, name: string, csv: string) {
  await page.getByLabel("CSV file").setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(csv) });
}

test("imports members after a dry run, with an error report for a file that has problems", async ({ page, browser }, info) => {
  // Each run (desktop, then mobile) imports its own people.
  const tag = info.project.name;
  await page.goto("/admin/import");
  await expect(page.getByRole("heading", { name: "Import", level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);

  // A file with problems: nothing is imported, and the report downloads.
  await chooseFile(page, "old-system.csv", `First name,Surname,E-mail,Club\nAsha,Patel,asha.${tag}@example.com,Atlantis\nBen,Okoro,not-an-email,\n`);
  await expect(page.getByRole("heading", { name: "2. Match the columns" })).toBeVisible();
  await expect(page.getByLabel("Column for email")).toHaveValue("2");
  await page.getByRole("button", { name: "Check the file" }).click();
  await expect(page.getByText("2 problems")).toBeVisible();
  const problems = page.getByRole("region", { name: "Problems" });
  await expect(problems.getByText("No open location has this name or code")).toBeVisible();
  await expect(problems.getByText("Not an email address")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Import \d/ })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await screenshot(page, "import-problems");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the error report" }).click();
  expect((await download).suggestedFilename()).toBe("members-import-problems.csv");

  // The fixed file goes through.
  await page.getByRole("button", { name: "Choose the file again" }).click();
  await chooseFile(page, "old-system.csv", `First name,Surname,E-mail,Club\nAsha,Patel,asha.${tag}@example.com,\nBen,Okoro,ben.${tag}@example.com,\n`);
  await page.getByRole("button", { name: "Check the file" }).click();
  await expect(page.getByText("2 members ready")).toBeVisible();
  await expect(page.getByRole("region", { name: /to be imported/ }).getByText(`asha.${tag}@example.com`)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page);
  await screenshot(page, "import-dry-run");
  await page.getByRole("button", { name: "Import 2 members" }).click();
  await expect(page.getByRole("heading", { name: "Imported" })).toBeVisible();
  await expect(page.getByText(/2 members imported/)).toBeVisible();
  await expect(page.getByText(/\d+ imported members haven't set a password yet/)).toBeVisible();
  await screenshot(page, "import-done");

  // This copy has no email, so the invitation links are shown. Asha uses hers.
  await page.getByText(/Invitation links/).click();
  const href = await page.getByRole("listitem").filter({ hasText: `asha.${tag}@example.com` }).getByRole("link", { name: "set password" }).getAttribute("href");
  const member = await browser.newContext();
  const memberPage = await member.newPage();
  await memberPage.goto(href!);
  await expect(memberPage.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  const password = `imported-${Date.now()}-pw`;
  await memberPage.getByLabel("New password", { exact: true }).fill(password);
  await memberPage.getByLabel("New password again").fill(password);
  await memberPage.getByRole("button", { name: "Save new password" }).click();
  // Signed in, with no membership yet: the welcome steps to choose one.
  await expect(memberPage.getByRole("heading", { name: /Welcome, Asha/ })).toBeVisible();
  await member.close();
});
