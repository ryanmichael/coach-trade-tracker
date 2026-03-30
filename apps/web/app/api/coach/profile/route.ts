import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Returns raw CoachProfile DB rows for the Intelligence UI.
// The context builder uses loadProfile() directly — not this endpoint.
export async function GET() {
  try {
    const entries = await prisma.coachProfile.findMany({
      orderBy: [{ key: "asc" }],
    });
    return NextResponse.json(entries);
  } catch (err) {
    console.error("Coach profile load error:", err);
    return NextResponse.json({ error: "Failed to load Coach profile" }, { status: 500 });
  }
}
