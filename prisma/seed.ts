import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { isDatabaseEmpty, resetDatabase, seedDatabase } from "./seed-data";

// Usage:
//   npm run db:seed            fill an empty database with fictional demo data
//   npm run db:seed -- --reset wipe and re-seed (local databases only)
//
// Refuses to run with NODE_ENV=production, and never touches a database that
// already has members or staff unless --reset is given for a local database.
//
// The demo accounts' password comes from SEED_DEMO_PASSWORD. Without it, a
// random one is made and printed once, here, in this terminal; it isn't
// saved anywhere (D-110). Every seeded account must change it at first
// sign-in.

function isLocalDatabase(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return ["localhost", "127.0.0.1", "::1", "postgres", "db"].includes(hostname) || /test/i.test(pathname);
  } catch {
    return false;
  }
}

export function demoPassword(source: string | undefined): { password: string; generated: boolean } {
  if (source) {
    if (source.length < 10) throw new Error("SEED_DEMO_PASSWORD must be at least 10 characters.");
    return { password: source, generated: false };
  }
  return { password: randomBytes(15).toString("base64url"), generated: true };
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed with NODE_ENV=production.");
  if (!url) throw new Error("DATABASE_URL is not set.");

  const reset = process.argv.includes("--reset");
  const prisma = new PrismaClient();
  try {
    if (reset) {
      if (!isLocalDatabase(url)) throw new Error("--reset is only allowed against a local or test database.");
      await resetDatabase(prisma);
      // Start plans from config too, so benefits match the current config.
      await prisma.membershipPlan.deleteMany();
    } else if (!(await isDatabaseEmpty(prisma))) {
      console.info("Database already has members or staff. Nothing seeded. Use --reset on a local database to start over.");
      return;
    }
    const { password, generated } = demoPassword(process.env.SEED_DEMO_PASSWORD);
    const result = await seedDatabase(prisma, { password });
    console.info("Seeded fictional demo data:", result);
    if (generated) {
      console.info(`\nDemo accounts' password (shown once, not saved anywhere): ${password}`);
      console.info("Set SEED_DEMO_PASSWORD to choose your own next time.");
    } else {
      console.info("\nDemo accounts use the password in SEED_DEMO_PASSWORD.");
    }
    console.info("Each demo account must change its password at first sign-in.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
