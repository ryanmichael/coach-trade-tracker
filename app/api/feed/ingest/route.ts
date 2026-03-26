import { NextRequest, NextResponse } from "next/server";
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

interface IncomingTrade {
  ticker: string;
  direction?: string;
  priceTargetLow?: number | null;
  priceTargetHigh?: number | null;
  priceTargetPercent?: number | null;
  priceConfirmation?: number | null;
  projectedDate?: string | null;
  stopLoss?: number | null;
  supportLevel?: number | null;
  resistanceLevel?: number | null;
  confidence?: number;
  sourceType?: string;
  rawExtract?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      content,
      postedAt,
      imageStoragePaths = [],
      imageAnalysis = null,
      ingestionMethod = "manual_paste",
      parsedTrades = [],
      chartData = null,
      // action: "feed_only" | "feed_watchlist" | "feed_active"
      action = "feed_only",
    } = body as {
      content: string;
      postedAt?: string;
      imageStoragePaths?: string[];
      imageAnalysis?: unknown;
      ingestionMethod?: string;
      parsedTrades?: IncomingTrade[];
      chartData?: unknown;
      action?: "feed_only" | "feed_watchlist" | "feed_active";
    };

    if (!content) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    await ensureUser();

    // Save CoachPost
    const post = await prisma.coachPost.create({
      data: {
        content,
        postedAt: postedAt ? new Date(postedAt) : new Date(),
        imageStoragePaths,
        imageAnalysis: imageAnalysis ?? undefined,
        hasImages: imageStoragePaths.length > 0,
        ingestionMethod,
        chartData: chartData ?? undefined,
      },
    });

    // Load prior ParsedTrades for each unique ticker in this ingest batch.
    // Used to inherit stable fields (target, stop, support) when an update
    // post omits them rather than re-stating them.
    const uniqueTickers = [...new Set(parsedTrades.map((t) => t.ticker.toUpperCase()))];
    const priorTradeMap = new Map<string, {
      direction: string;
      priceTargetLow: number | null;
      priceTargetHigh: number | null;
      priceTargetPercent: number | null;
      priceConfirmation: number | null;
      projectedDate: Date | null;
      stopLoss: number | null;
      supportLevel: number | null;
      resistanceLevel: number | null;
    }>();
    await Promise.all(
      uniqueTickers.map(async (ticker) => {
        const prior = await prisma.parsedTrade.findFirst({
          where: { ticker },
          orderBy: { createdAt: "desc" },
          select: {
            direction: true,
            priceTargetLow: true,
            priceTargetHigh: true,
            priceTargetPercent: true,
            priceConfirmation: true,
            projectedDate: true,
            stopLoss: true,
            supportLevel: true,
            resistanceLevel: true,
          },
        });
        if (prior) priorTradeMap.set(ticker, prior);
      })
    );

    // Save ParsedTrades — inheriting null fields from prior trade for same ticker
    const savedTrades = await Promise.all(
      parsedTrades.map((t: IncomingTrade) => {
        const prior = priorTradeMap.get(t.ticker.toUpperCase());
        // Inherit: use new value when provided, fall back to prior when null
        const inherit = <T>(newVal: T | null | undefined, priorVal: T | null | undefined): T | null =>
          newVal != null ? newVal : (priorVal ?? null);

        return prisma.parsedTrade.create({
          data: {
            coachPostId: post.id,
            ticker: t.ticker,
            // Direction is only inherited if explicitly absent AND prior exists — new post takes priority
            direction: t.direction ?? prior?.direction ?? "long",
            priceTargetLow: inherit(t.priceTargetLow, prior?.priceTargetLow),
            priceTargetHigh: inherit(t.priceTargetHigh, prior?.priceTargetHigh),
            priceTargetPercent: inherit(t.priceTargetPercent, prior?.priceTargetPercent),
            priceConfirmation: inherit(t.priceConfirmation, prior?.priceConfirmation),
            projectedDate: t.projectedDate
              ? new Date(t.projectedDate)
              : (prior?.projectedDate ?? null),
            stopLoss: inherit(t.stopLoss, prior?.stopLoss),
            supportLevel: inherit(t.supportLevel, prior?.supportLevel),
            resistanceLevel: inherit(t.resistanceLevel, prior?.resistanceLevel),
            confidence: t.confidence ?? 0,
            sourceType: t.sourceType ?? "text",
            rawExtract: t.rawExtract ?? content.slice(0, 200),
          },
        });
      })
    );

    // Create WatchlistItem if requested
    if (action === "feed_watchlist" && savedTrades.length > 0) {
      const t = savedTrades[0];
      await prisma.watchlistItem.upsert({
        where: {
          userId_ticker: { userId: DEFAULT_USER_ID, ticker: t.ticker },
        },
        update: {
          parsedTradeId: t.id,
          coachPostId: post.id,
          status: "watching",
        },
        create: {
          userId: DEFAULT_USER_ID,
          ticker: t.ticker,
          parsedTradeId: t.id,
          coachPostId: post.id,
          status: "watching",
        },
      });
    }

    // Create ActiveTrade if requested
    if (action === "feed_active" && savedTrades.length > 0) {
      const t = savedTrades[0];
      await prisma.activeTrade.create({
        data: {
          userId: DEFAULT_USER_ID,
          ticker: t.ticker,
          parsedTradeId: t.id,
          priceConfirmation: t.priceConfirmation,
          priceTargetHigh: t.priceTargetHigh,
          priceTargetLow: t.priceTargetLow,
          projectedDate: t.projectedDate,
          stopLoss: t.stopLoss,
          supportLevel: t.supportLevel,
          resistanceLevel: t.resistanceLevel,
          status: "pending",
        },
      });
    }

    return NextResponse.json({
      post,
      parsedTrades: savedTrades,
      message: "Saved successfully",
    });
  } catch (err) {
    console.error("Ingest error:", err);
    return NextResponse.json({ error: "Failed to save post" }, { status: 500 });
  }
}
