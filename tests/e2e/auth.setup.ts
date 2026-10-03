import { test as setup } from "@playwright/test";
import { signInMember, signInStaff } from "./helpers";

// Signs each test persona in once and saves the session, so the specs don't
// trip the login rate limit (10 attempts per IP per 15 minutes).
const STAFF = { owner: "owner@example.com", frontdesk: "frontdesk@example.com", trainer: "trainer@example.com" } as const;

for (const [name, email] of Object.entries(STAFF)) {
  setup(`sign in ${name}`, async ({ page }) => {
    await signInStaff(page, email);
    await page.context().storageState({ path: `tests/e2e/.auth/${name}.json` });
  });
}

setup("sign in member", async ({ page }) => {
  await signInMember(page);
  await page.context().storageState({ path: "tests/e2e/.auth/member.json" });
});
