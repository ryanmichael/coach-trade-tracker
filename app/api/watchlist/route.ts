import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";

async function ensureUser() {
  const existing = await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } });
  if (!existing) {
    await prisma.user.create({
      data: { id: DEFAULT_USER_ID, email: `${DEFAULT_USER_ID}@localhost`, name: "Trader" },
    });
  }
}

export async function GET() {
  try {
    await ensureUser();
    const items = await prisma.watchlistItem.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { addedAt: "desc" },
      include: {
        parsedTrade: {
          select: {
            direction: true,
            priceConfirmation: true,
            priceTargetHigh: true,
            priceTargetLow: true,
            confidence: true,
          },
        },
        coachPost: {
          select: {
            id: true,
            postedAt: true,
          },
        },
      },
    });

    return NextResponse.json(items);
  } catch (err: unknown) {
    // Return empty array when DB is unreachable so the app loads gracefully
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "ECONNREFUSED") {
      console.warn("[GET /api/watchlist] DB unreachable, returning empty list");
      return NextResponse.json([]);
    }
    console.error("[GET /api/watchlist]", err);
    return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticker, parsedTradeId, coachPostId, notes } = body;

    if (!ticker) {
      return NextResponse.json({ error: "ticker is required" }, { status: 400 });
    }

    await ensureUser();

    // Auto-link the first ParsedTrade for the post when parsedTradeId isn't explicitly provided
    let resolvedParsedTradeId: string | null = parsedTradeId ?? null;
    if (!resolvedParsedTradeId && coachPostId) {
      const trade = await prisma.parsedTrade.findFirst({
        where: { coachPostId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      resolvedParsedTradeId = trade?.id ?? null;
    }

    const item = await prisma.watchlistItem.upsert({
      where: { userId_ticker: { userId: DEFAULT_USER_ID, ticker: ticker.toUpperCase() } },
      create: {
        userId: DEFAULT_USER_ID,
        ticker: ticker.toUpperCase(),
        parsedTradeId: resolvedParsedTradeId,
        coachPostId: coachPostId ?? null,
        notes: notes ?? null,
        status: "watching",
      },
      update: {
        parsedTradeId: resolvedParsedTradeId ?? undefined,
        coachPostId: coachPostId ?? undefined,
        notes: notes ?? undefined,
      },
      include: {
        parsedTrade: {
          select: {
            direction: true,
            priceConfirmation: true,
            priceTargetHigh: true,
            priceTargetLow: true,
            confidence: true,
          },
        },
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error("[POST /api/watchlist]", err);
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
  }
}
