import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppUser } from "@/lib/auth";
import {
  runOptionsPipeline,
  RISK_CONFIG,
  type TradeInput,
  type EnrichedContract,
  type RiskTolerance,
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
  const riskParam = params.get("riskTolerance") as RiskTolerance | null;
  const riskTolerance: RiskTolerance = (riskParam === "high" || riskParam === "low") ? riskParam : "medium";

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

  try {
    // Single pipeline call — risk threads through fetch, filter, and scoring
    const result = await runOptionsPipeline(trade, riskTolerance);

    // Return top 15
    const top = result.contracts.slice(0, 15);
    const rc = RISK_CONFIG[riskTolerance];

    console.log(`[Options chain] ${ticker} ${direction} risk=${riskTolerance}: raw→${result.totalRaw} filtered→${result.totalFiltered} enriched→${result.contracts.length}`);

    // Snapshot top 3 for prediction tracking (fire-and-forget)
    const user = await getAppUser();
    if (top.length > 0) {
      snapshotPredictions(top.slice(0, 3), ticker, direction, currentPrice, targetPrice, projectedDate, user?.id ?? null).catch(
        (err) => console.warn("[Options snapshot] Failed to save:", err)
      );
    }

    return NextResponse.json(
      {
        contracts: top,
        totalRaw: result.totalRaw,
        totalFiltered: result.totalFiltered,
        riskTolerance,
        filters: {
          contractType: direction === "LONG" ? "call" : "put",
          minOI: rc.filters.minOpenInterest,
          maxSpread: rc.filters.maxSpreadPct + "%",
          minDtePastProjected: rc.filters.minDtePastProjected + "d",
        },
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (err) {
    console.error("[Options chain] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch options chain", detail: String(err) },
      { status: 500 }
    );
  }
}

/** Save top contracts as prediction snapshots for later validation */
async function snapshotPredictions(
  contracts: EnrichedContract[],
  ticker: string,
  direction: string,
  currentPrice: number,
  targetPrice: number,
  projectedDate: string,
  userId: string | null
) {
  const sessionId = `${ticker}-${direction}-${Date.now()}`;
  const projDate = new Date(projectedDate + "T00:00:00Z");

  await prisma.optionsSnapshot.createMany({
    data: contracts.map((c, i) => ({
      sessionId,
      userId,
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
