import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  fetchOptionsChain,
  filterContracts,
  enrichContracts,
  DEFAULT_FILTERS,
  type TradeInput,
  type EnrichedContract,
} from "@/lib/options";

// GET /api/options/chain?ticker=SPY&direction=LONG&currentPrice=561.42&targetPrice=582&projectedDate=2026-04-18
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const ticker = params.get("ticker")?.toUpperCase();
  const direction = params.get("direction")?.toUpperCase() as "LONG" | "SHORT" | undefined;
  const currentPrice = parseFloat(params.get("currentPrice") ?? "");
  const targetPrice = parseFloat(params.get("targetPrice") ?? "");
  const projectedDate = params.get("projectedDate") ?? "";
  const stopLoss = parseFloat(params.get("stopLoss") ?? "0");

  if (!ticker || !direction || !currentPrice || !targetPrice || !projectedDate) {
    return NextResponse.json(
      { error: "Required params: ticker, direction, currentPrice, targetPrice, projectedDate" },
      { status: 400 }
    );
  }

  if (direction !== "LONG" && direction !== "SHORT") {
    return NextResponse.json(
      { error: "direction must be LONG or SHORT" },
      { status: 400 }
    );
  }

  const trade: TradeInput = {
    ticker,
    direction,
    currentPrice,
    priceTargetHigh: targetPrice,
    projectedDate,
    stopLoss,
    hasCoachRec: false,
  };

  // Fetch from Polygon
  const rawContracts = await fetchOptionsChain(
    ticker,
    direction,
    currentPrice,
    projectedDate,
    targetPrice
  );

  // Filter
  const filtered = filterContracts(rawContracts, trade, DEFAULT_FILTERS);

  // Enrich + rank
  const enriched = enrichContracts(filtered, trade);

  // Return top 15
  const top = enriched.slice(0, 15);

  console.log(`[Options chain] ${ticker} ${direction}: refs→${rawContracts.length} filtered→${filtered.length} enriched→${enriched.length}`);

  // Snapshot top 3 for prediction tracking (fire-and-forget)
  if (top.length > 0) {
    snapshotPredictions(top.slice(0, 3), ticker, direction, currentPrice, targetPrice, projectedDate).catch(
      (err) => console.warn("[Options snapshot] Failed to save:", err)
    );
  }

  return NextResponse.json(
    {
      contracts: top,
      totalRaw: rawContracts.length,
      totalFiltered: filtered.length,
      filters: {
        contractType: direction === "LONG" ? "call" : "put",
        minOI: DEFAULT_FILTERS.minOpenInterest,
        maxSpread: DEFAULT_FILTERS.maxSpreadPct + "%",
        minDtePastProjected: DEFAULT_FILTERS.minDtePastProjected + "d",
      },
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}

/** Save top contracts as prediction snapshots for later validation */
async function snapshotPredictions(
  contracts: EnrichedContract[],
  ticker: string,
  direction: string,
  currentPrice: number,
  targetPrice: number,
  projectedDate: string
) {
  // Generate a session ID to group contracts from the same request
  const sessionId = `${ticker}-${direction}-${Date.now()}`;
  const projDate = new Date(projectedDate + "T00:00:00Z");

  await prisma.optionsSnapshot.createMany({
    data: contracts.map((c, i) => ({
      sessionId,
      ticker,
      direction,
      currentPrice,
      targetPrice,
      projectedDate: projDate,
      contractTicker: c.id,
      strike: c.strike,
      expiry: c.expiry,
      contractType: c.contractType,
      askAtRec: c.ask,
      forwardROI: c.forwardROI,
      compositeScore: c.compositeScore,
      ivEstimate: c.iv,
      rank: i + 1,
      isBestMatch: c.isSweetSpot,
    })),
  });
}
