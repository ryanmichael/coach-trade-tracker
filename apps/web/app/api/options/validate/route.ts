import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const POLYGON_BASE = "https://api.polygon.io";

/**
 * POST /api/options/validate
 *
 * Finds snapshots past their projected date that haven't been validated,
 * fetches actual stock + option prices from Polygon, computes actual ROI,
 * and stores results. Designed to be called by a daily cron.
 *
 * Query params:
 *   limit — max snapshots to validate per run (default 20)
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not configured" }, { status: 500 });
  }

  // Find unvalidated snapshots past their projected date
  const snapshots = await prisma.optionsSnapshot.findMany({
    where: {
      validatedAt: null,
      projectedDate: { lt: new Date() },
    },
    orderBy: { projectedDate: "asc" },
    take: limit,
  });

  if (snapshots.length === 0) {
    return NextResponse.json({ message: "No snapshots to validate", validated: 0 });
  }

  // Group by session to batch stock price lookups
  const tickers = [...new Set(snapshots.map((s) => s.ticker))];

  // Fetch current stock prices for all tickers
  const stockPrices: Record<string, number> = {};
  for (const ticker of tickers) {
    try {
      const res = await fetch(
        `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/prev?apiKey=${apiKey}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        const bar = data.results?.[0];
        if (bar?.c) stockPrices[ticker] = bar.c;
      }
    } catch {
      // Skip this ticker
    }
  }

  let validated = 0;
  const errors: string[] = [];

  for (const snap of snapshots) {
    try {
      // Fetch the option's current/recent price
      let actualOptionPrice: number | null = null;

      const optRes = await fetch(
        `${POLYGON_BASE}/v2/aggs/ticker/${snap.contractTicker}/prev?apiKey=${apiKey}`,
        { cache: "no-store" }
      );
      if (optRes.ok) {
        const optData = await optRes.json();
        const bar = optData.results?.[0];
        if (bar?.c) actualOptionPrice = bar.c;
      }

      const stockPrice = stockPrices[snap.ticker] ?? null;

      if (actualOptionPrice !== null) {
        const actualROI = ((actualOptionPrice - snap.askAtRec) / snap.askAtRec) * 100;
        const predictionError = Math.abs(snap.forwardROI - actualROI);
        // Direction correct: we predicted profit and it was profit, or loss and loss
        const directionCorrect = (snap.forwardROI >= 0) === (actualROI >= 0);

        await prisma.optionsSnapshot.update({
          where: { id: snap.id },
          data: {
            actualOptionPrice,
            stockPriceAtCheck: stockPrice,
            actualROI: Math.round(actualROI * 10) / 10,
            predictionError: Math.round(predictionError * 10) / 10,
            directionCorrect,
            validatedAt: new Date(),
          },
        });
        validated++;
      } else {
        // Option may have expired or been delisted — mark validated with null actual
        await prisma.optionsSnapshot.update({
          where: { id: snap.id },
          data: {
            stockPriceAtCheck: stockPrice,
            validatedAt: new Date(),
          },
        });
        validated++;
      }
    } catch (err) {
      errors.push(`${snap.contractTicker}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    message: `Validated ${validated}/${snapshots.length} snapshots`,
    validated,
    total: snapshots.length,
    tickersChecked: tickers,
    errors: errors.length > 0 ? errors : undefined,
  });
}
