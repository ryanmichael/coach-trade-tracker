import { NextResponse } from "next/server";
import { getMarketStatus } from "@/lib/polygon";

// GET /api/market/status
export async function GET() {
  const result = getMarketStatus();
  return NextResponse.json(result);
}
