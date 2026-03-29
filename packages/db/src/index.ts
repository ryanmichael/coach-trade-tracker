// Re-export PrismaClient and all generated types.
// The actual singleton (with adapter) is created in apps/web/lib/db.ts.
// This file intentionally does NOT create a PrismaClient instance because
// Prisma v7 requires a driver adapter to be passed at construction time.

export { PrismaClient, Prisma } from "./generated/prisma";
export * from "./generated/prisma";
