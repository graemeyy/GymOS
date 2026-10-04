import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD, isDatabaseEmpty, resetDatabase, seedDatabase } from "./seed-data";

// Usage:
//   npm run db:seed            fill an empty database with fictional demo data
//   npm run db:seed -- --reset wipe and re-seed (local databases only)
//
// Refuses to run with NODE_ENV=production, and never touches a database that
// already has members or staff unless --reset is given for a local database.

function isLocalDatabase(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return ["localhost", "127.0.0.1", "::1", "postgres", "db"].includes(hostname) || /test/i.test(pathname);
  } catch {
    return false;
  }
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
    const result = await seedDatabase(prisma);
    console.info("Seeded fictional demo data:", result);
    console.info(`Demo sign-in password for every seeded account: ${DEMO_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
