/**
 * src/lib/db.ts
 *
 * Prisma Client singleton for use in Next.js API routes and server components.
 * Uses a global variable in development to prevent hot-reload from creating
 * multiple Prisma Client instances.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
