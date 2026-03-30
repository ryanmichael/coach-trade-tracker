import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    // DIRECT_URL bypasses Supabase connection pooler — required for migrations
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:password@localhost:5432/coach_trade_tracker",
  },
});
