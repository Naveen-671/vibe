// import { PrismaClient } from "@prisma/client";
// import { PrismaClient } from "../src/generated/prisma";
// // Instantiate Prisma Client
// const prisma = new PrismaClient();
import { prisma } from "@/lib/db"; // Import the singleton instance
async function main() {
  console.log(`Start seeding ...`);

  // Your actual seeding logic will go here.
  // For now, we'll leave it empty.

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Always disconnect the Prisma Client
    await prisma.$disconnect();
  });
