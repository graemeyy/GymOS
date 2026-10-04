import { execSync } from "node:child_process";
import { assertTestDatabase, TEST_DATABASE_URL } from "./test-env";

// Applies migrations to a fresh test database once per run.
export default function setup() {
  assertTestDatabase(TEST_DATABASE_URL);
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
