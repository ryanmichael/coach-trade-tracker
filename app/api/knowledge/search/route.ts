import { NextRequest, NextResponse } from "next/server";
import { search } from "@repo/agents";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const results = await search(prisma, q);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Knowledge search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
