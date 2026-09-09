import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding GymOS database...");
  const result = await seedDatabase(prisma);
  console.log("Seeding complete:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
