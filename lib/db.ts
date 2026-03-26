// db.ts — Prisma v7 client singleton with pg adapter
// In Prisma v7, the generated "client" engine type requires a driver adapter.
// @prisma/adapter-pg is used backed by a pg connection pool.
//
// We import PrismaClient from @repo/db (workspace package transpiled by Next.js).
// The adapter is passed to the constructor so the client engine initializes correctly.

import { PrismaClient } from "@repo/db";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined;
};

function createPrismaClient(): PrismaClientInstance {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:password@localhost:5432/coach_trade_tracker";

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma: PrismaClientInstance =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
