import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    db: false,
    priceFeed: false,
    jobQueue: false,
    timestamp: new Date().toISOString(),
  });
}
