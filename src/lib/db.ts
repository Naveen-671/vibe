// import { PrismaClient } from "@/generated/prisma";

// const globalForPrisma = global as unknown as {
//   prisma: PrismaClient;
// };

// export const prisma = globalForPrisma.prisma || new PrismaClient();

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// // export default prisma;

// src/lib/db.ts
import { PrismaClient } from "../generated/prisma";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

declare global {
  // This must be `var` to work correctly with Next.js hot-reloading.
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export { prisma };

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
