import { test as setup } from "@playwright/test";
import { firstSignIn } from "./helpers";

// Signs each test persona in once and saves the session, so the specs don't
// trip the login rate limit (10 attempts per IP per 15 minutes). This is
// each seeded account's first sign-in, so it also goes through the required
// password change (D-111).
// deskSecond works at the demo's second location only (D-128).
const STAFF = { owner: "owner@example.com", frontdesk: "frontdesk@example.com", trainer: "trainer@example.com", deskSecond: "desk.second@example.com" } as const;

for (const [name, email] of Object.entries(STAFF)) {
  setup(`sign in ${name}`, async ({ page }) => {
    await firstSignIn(page, "staff", email);
    await page.waitForURL(/\/admin$/);
    await page.context().storageState({ path: `tests/e2e/.auth/${name}.json` });
  });
}

setup("sign in member", async ({ page }) => {
  await firstSignIn(page, "member", "charlotte.pham@example.com");
  await page.waitForURL(/\/member$/);
  await page.context().storageState({ path: "tests/e2e/.auth/member.json" });
});

// Used signed out by member-app.spec.ts; its required change is done here so
// that test can sign in normally.
setup("set up second member", async ({ page }) => {
  await firstSignIn(page, "member", "jack.osullivan@example.com");
});
