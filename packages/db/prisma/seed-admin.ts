/**
 * Seed script to create the admin user and invite.
 *
 * Usage:
 *   DATABASE_URL="..." npx tsx prisma/seed-admin.ts admin@example.com
 *
 * Idempotent — safe to run multiple times.
 */

import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx prisma/seed-admin.ts <admin-email>");
  process.exit(1);
}

const normalizedEmail = email.toLowerCase().trim();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create or find the admin user
  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (user) {
    if (!user.isAdmin) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true },
      });
      console.log(`Updated existing user to admin: ${user.email}`);
    } else {
      console.log(`Admin user already exists: ${user.email}`);
    }
  } else {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        isAdmin: true,
      },
    });
    console.log(`Created admin user: ${user.email}`);
  }

  // Create the invite record (auto-accepted)
  const existingInvite = await prisma.invite.findUnique({
    where: { email: normalizedEmail },
  });

  if (!existingInvite) {
    await prisma.invite.create({
      data: {
        email: normalizedEmail,
        invitedBy: user.id,
        acceptedAt: new Date(),
      },
    });
    console.log(`Created accepted invite for: ${normalizedEmail}`);
  } else {
    console.log(`Invite already exists for: ${normalizedEmail}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
