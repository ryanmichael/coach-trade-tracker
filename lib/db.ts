// db.ts — Prisma v7 client singleton with pg adapter
//
// Railway cannot reach Supabase over IPv6 (ENETUNREACH).
// Instead of patching DNS/net (bundler strips it), we parse the
// connection string and pass host/port/user/password/database
// directly to pg.Pool with an explicit IPv4 lookup function.

import dns from "dns/promises";
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

  // Parse the connection string to extract components
  const url = new URL(connectionString);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port || "5432", 10),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1), // remove leading /
    ssl: { rejectUnauthorized: false },
    // Force IPv4 resolution — Railway cannot reach Supabase over IPv6
    lookup: (hostname: string, _options: unknown, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
      dns.resolve4(hostname).then(
        (addresses) => callback(null, addresses[0], 4),
        (err) => callback(err as NodeJS.ErrnoException, "", 0)
      );
    },
  } as any);

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
