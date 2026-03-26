import { NextRequest, NextResponse } from "next/server";
import { fetchAggregates } from "@/lib/polygon";

// 6 months of daily bars for the chart
const HISTORY_DAYS = 180;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  const to = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - HISTORY_DAYS * 86_400_000);
  const from = fromDate.toISOString().slice(0, 10);

  const bars = await fetchAggregates(upper, 1, "day", from, to);

  return NextResponse.json(
    { bars: bars ?? [] },
    {
      headers: {
        // Cache 1 hour — daily bars don't change intraday
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    }
  );
}
