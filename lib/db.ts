// db.ts — Prisma v7 client singleton with pg adapter

import dns from "dns";
import net from "net";

// Monkey-patch net.connect to force IPv4 — Railway cannot reach Supabase over IPv6.
// dns.setDefaultResultOrder("ipv4first") and NODE_OPTIONS flag don't work reliably
// on Railway's container, so we intercept at the socket level.
const originalConnect = net.connect;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(net as any).connect = function (...args: any[]) {
  const opts = args[0];
  if (typeof opts === "object" && opts !== null && opts.host && !net.isIP(opts.host)) {
    opts.family = 4;
  }
  return originalConnect.apply(this, args);
};

dns.setDefaultResultOrder("ipv4first");

import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientInstance | undefined;
};

function createPrismaClient(): PrismaClientInstance {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:password@localhost:5432/coach_trade_tracker";

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any);

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
