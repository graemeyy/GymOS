import { execSync } from "node:child_process";
import { E2E_DATABASE_URL } from "../../playwright.config";

// Fresh schema and fictional seed data for every end-to-end run.
export default function globalSetup() {
  if (!/test/i.test(new URL(E2E_DATABASE_URL).pathname)) throw new Error("E2E database name must contain 'test'.");
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts --reset", { stdio: "inherit", env });
}
