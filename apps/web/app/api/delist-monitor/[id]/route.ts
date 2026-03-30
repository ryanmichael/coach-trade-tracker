import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DELETE /api/delist-monitor/[id] — remove a ticker from monitoring
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.delistMonitorTicker.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/delist-monitor/[id]]", err);
    return NextResponse.json({ error: "Failed to remove ticker" }, { status: 500 });
  }
}
