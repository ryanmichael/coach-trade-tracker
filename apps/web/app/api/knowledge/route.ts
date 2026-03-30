import { NextRequest, NextResponse } from "next/server";
import { addEntry } from "@/lib/agents";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { category, key, data } = await req.json();

    if (!category || !key || !data) {
      return NextResponse.json(
        { error: "category, key, and data are required" },
        { status: 400 }
      );
    }

    const entry = await addEntry(prisma, category, key, data, "user_added");
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error("Knowledge add error:", err);
    return NextResponse.json({ error: "Failed to add knowledge entry" }, { status: 500 });
  }
}
