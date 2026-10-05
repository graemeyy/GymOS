import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { E2E_DATABASE_URL } from "../../playwright.config";

// Fresh schema and fictional seed data for every end-to-end run. The demo
// password is random per run (D-110) and reaches the tests through these
// environment variables.
export default function globalSetup() {
  if (!/test/i.test(new URL(E2E_DATABASE_URL).pathname)) throw new Error("E2E database name must contain 'test'.");
  const seedPassword = randomBytes(15).toString("base64url");
  process.env.E2E_SEED_PASSWORD = seedPassword;
  process.env.E2E_PASSWORD = `${seedPassword}-changed`;
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, SEED_DEMO_PASSWORD: seedPassword };
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { stdio: "inherit", env });
  execSync("npx tsx --conditions=react-server prisma/seed.ts --reset", { stdio: "inherit", env });
}
