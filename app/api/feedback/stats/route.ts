import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Count corrections by type (processed only)
    const byType = await prisma.parseFeedback.groupBy({
      by: ["correctionType"],
      where: { processed: true },
      _count: { id: true },
    });

    // Total counts
    const total = await prisma.parseFeedback.count();
    const processed = await prisma.parseFeedback.count({ where: { processed: true } });

    const typeCounts: Record<string, number> = {};
    for (const row of byType) {
      if (row.correctionType) {
        typeCounts[row.correctionType] = row._count.id;
      }
    }

    return NextResponse.json({
      total,
      processed,
      pending: total - processed,
      byType: typeCounts,
    });
  } catch (err) {
    console.error("Feedback stats error:", err);
    return NextResponse.json({ error: "Failed to load feedback stats" }, { status: 500 });
  }
}
