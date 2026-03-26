import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/delist-monitor/[id]/history — check history for a ticker
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const results = await prisma.delistCheckResult.findMany({
      where: { delistMonitorTickerId: id },
      orderBy: { checkDate: "desc" },
      take: 50,
    });
    return NextResponse.json(results);
  } catch (err) {
    console.error("[GET /api/delist-monitor/[id]/history]", err);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
