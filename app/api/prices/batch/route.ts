import { NextRequest, NextResponse } from "next/server";
import { fetchPrices } from "@/lib/polygon";

// GET /api/prices/batch?tickers=MAGS,SOXS,RUT,SOX
export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers");
  if (!tickersParam) {
    return NextResponse.json({ error: "tickers query param required" }, { status: 400 });
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 20); // cap at 20 tickers per request

  if (tickers.length === 0) {
    return NextResponse.json({ error: "no valid tickers" }, { status: 400 });
  }

  const prices = await fetchPrices(tickers);

  return NextResponse.json(
    { prices, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
