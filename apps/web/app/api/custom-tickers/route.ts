import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppUser } from "@/lib/auth";

/**
 * GET /api/custom-tickers — List current user's custom tickers
 * POST /api/custom-tickers — Add a custom ticker
 */
export async function GET() {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tickers = await prisma.customTicker.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ tickers });
}

export async function POST(req: NextRequest) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ticker = body.ticker?.toUpperCase()?.trim();

  if (!ticker) {
    return NextResponse.json({ error: "Ticker required" }, { status: 400 });
  }

  // Upsert — create or return existing
  const existing = await prisma.customTicker.findUnique({
    where: { userId_ticker: { userId: user.id, ticker } },
  });

  if (existing) {
    return NextResponse.json({ ticker: existing });
  }

  const created = await prisma.customTicker.create({
    data: {
      userId: user.id,
      ticker,
      direction: body.direction ?? null,
      currentPrice: body.currentPrice ?? null,
      targetPrice: body.targetPrice ?? null,
      projectedDate: body.projectedDate ? new Date(body.projectedDate) : null,
      stopLoss: body.stopLoss ?? null,
      riskTolerance: body.riskTolerance ?? "medium",
    },
  });

  return NextResponse.json({ ticker: created }, { status: 201 });
}
