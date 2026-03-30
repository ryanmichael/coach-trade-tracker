import { NextResponse } from "next/server";
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

// GET /api/delist-monitor — list all monitored tickers with latest check results
export async function GET() {
  try {
    await ensureUser();
    const tickers = await prisma.delistMonitorTicker.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { addedAt: "desc" },
      include: {
        checkResults: {
          orderBy: { checkDate: "desc" },
          take: 5,
        },
      },
    });
    return NextResponse.json(tickers);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "ECONNREFUSED") {
      return NextResponse.json([]);
    }
    console.error("[GET /api/delist-monitor]", err);
    return NextResponse.json({ error: "Failed to fetch delist monitor" }, { status: 500 });
  }
}

// POST /api/delist-monitor — add tickers (comma-delimited string)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const raw: string = body.tickers ?? "";

    // Parse comma-delimited, uppercase, dedupe
    const parsed = [
      ...new Set(
        raw
          .split(",")
          .map((t: string) => t.trim().toUpperCase())
          .filter((t: string) => t.length > 0 && t.length <= 10 && /^[A-Z]+$/.test(t))
      ),
    ];

    if (parsed.length === 0) {
      return NextResponse.json({ error: "No valid tickers provided" }, { status: 400 });
    }

    await ensureUser();

    // Check which are already monitored
    const existing = await prisma.delistMonitorTicker.findMany({
      where: { userId: DEFAULT_USER_ID, ticker: { in: parsed } },
      select: { ticker: true },
    });
    const existingSet = new Set(existing.map((e) => e.ticker));

    const toCreate = parsed.filter((t) => !existingSet.has(t));
    const duplicates = parsed.filter((t) => existingSet.has(t));

    const created = await Promise.all(
      toCreate.map((ticker) =>
        prisma.delistMonitorTicker.create({
          data: { userId: DEFAULT_USER_ID, ticker },
        })
      )
    );

    return NextResponse.json(
      { added: created, duplicates, invalid: [] },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/delist-monitor]", err);
    return NextResponse.json({ error: "Failed to add tickers" }, { status: 500 });
  }
}
