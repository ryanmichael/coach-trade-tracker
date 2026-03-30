import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const posts = await prisma.coachPost.findMany({
      orderBy: { postedAt: "desc" },
      take: 100,
      include: {
        parsedTrades: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return NextResponse.json(posts);
  } catch (err: unknown) {
    // Return empty array when DB is unreachable so the app loads gracefully
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "ECONNREFUSED") {
      console.warn("[GET /api/feed] DB unreachable, returning empty list");
      return NextResponse.json([]);
    }
    console.error("[GET /api/feed]", err);
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 });
  }
}
