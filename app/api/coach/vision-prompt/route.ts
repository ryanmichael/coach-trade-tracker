import { NextResponse } from "next/server";
import { getCoachVisionPrompt } from "@repo/agents";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const prompt = await getCoachVisionPrompt(prisma);
    return NextResponse.json({ prompt });
  } catch (err) {
    console.error("Vision prompt error:", err);
    return NextResponse.json(
      { error: "Failed to build vision prompt", detail: String(err) },
      { status: 500 }
    );
  }
}
