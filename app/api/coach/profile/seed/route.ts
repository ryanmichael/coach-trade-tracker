import { NextResponse } from "next/server";
import { seedCoachIntelligence } from "@repo/agents";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const result = await seedCoachIntelligence(prisma);
    return NextResponse.json({
      success: true,
      profileEntries: result.profileEntries,
      knowledgeEntries: result.knowledgeEntries,
      message: `Seeded ${result.profileEntries} profile entries and ${result.knowledgeEntries} knowledge base entries.`,
    });
  } catch (err) {
    console.error("Coach intelligence seed error:", err);
    return NextResponse.json(
      { error: "Seed failed", detail: String(err) },
      { status: 500 }
    );
  }
}
