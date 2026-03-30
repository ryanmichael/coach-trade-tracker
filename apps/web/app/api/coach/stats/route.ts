import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [profileKeyCount, kbEntryCount, correctionCount, refDocCount] = await Promise.all([
      prisma.coachProfile.count(),
      prisma.knowledgeEntry.count(),
      prisma.parseFeedback.count(),
      prisma.referenceDocument.count({ where: { status: "complete" } }),
    ]);

    return NextResponse.json({ profileKeyCount, kbEntryCount, correctionCount, refDocCount });
  } catch (err) {
    console.error("[GET /api/coach/stats]", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
