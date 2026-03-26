import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";

// GET /api/delist-monitor/summary — lightweight counts for dashboard badge
export async function GET() {
  try {
    const [yellowCount, redCount] = await Promise.all([
      prisma.delistMonitorTicker.count({
        where: { userId: DEFAULT_USER_ID, status: "yellow" },
      }),
      prisma.delistMonitorTicker.count({
        where: { userId: DEFAULT_USER_ID, status: "red" },
      }),
    ]);
    return NextResponse.json({ yellowCount, redCount });
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "ECONNREFUSED") {
      return NextResponse.json({ yellowCount: 0, redCount: 0 });
    }
    console.error("[GET /api/delist-monitor/summary]", err);
    return NextResponse.json({ yellowCount: 0, redCount: 0 });
  }
}
