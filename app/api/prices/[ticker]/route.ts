import { NextRequest, NextResponse } from "next/server";
import { fetchPrice } from "@/lib/polygon";

// GET /api/prices/AAPL
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  const price = await fetchPrice(symbol);

  if (!price) {
    return NextResponse.json(
      { error: "Price unavailable — check POLYGON_API_KEY or ticker symbol" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { price, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
