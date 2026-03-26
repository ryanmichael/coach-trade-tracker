import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { checkSecEdgar } from "@/lib/sec-edgar";
import { checkVolumeDecline } from "@/lib/polygon";
import { checkWebForDelistNews } from "@/lib/web-search";
import { analyzeDelistRisk } from "@/lib/delist-analyzer";

const STATUS_PRIORITY: Record<string, number> = { green: 0, yellow: 1, red: 2 };

function worstStatus(
  ...levels: string[]
): "green" | "yellow" | "red" {
  let worst = "green";
  for (const level of levels) {
    if ((STATUS_PRIORITY[level] ?? 0) > (STATUS_PRIORITY[worst] ?? 0)) {
      worst = level;
    }
  }
  return worst as "green" | "yellow" | "red";
}

async function runChecks(req: Request) {
  try {
    const url = new URL(req.url);
    const singleTicker = url.searchParams.get("ticker");

    const where: { userId: string; ticker?: string } = { userId: DEFAULT_USER_ID };
    if (singleTicker) where.ticker = singleTicker.toUpperCase();

    const tickers = await prisma.delistMonitorTicker.findMany({ where });

    if (tickers.length === 0) {
      return NextResponse.json({ results: [], checkedAt: new Date().toISOString() });
    }

    const results = [];

    // Process sequentially to respect Polygon rate limits (5 req/min free tier)
    for (const item of tickers) {
      // Phase 1: SEC filings, volume, web search (parallel)
      const [edgar, volume, webSearch] = await Promise.all([
        checkSecEdgar(item.ticker),
        checkVolumeDecline(item.ticker),
        checkWebForDelistNews(item.ticker),
      ]);

      // Phase 2: AI risk analysis — feeds web snippets + Polygon data into Claude
      const webSnippets: string[] = [];
      if (webSearch.rawData && typeof webSearch.rawData === "object" && "topItems" in (webSearch.rawData as Record<string, unknown>)) {
        const items = (webSearch.rawData as { topItems: { title: string }[] }).topItems ?? [];
        webSnippets.push(...items.map((i) => i.title));
      }
      const aiAnalysis = await analyzeDelistRisk(item.ticker, webSnippets);

      // Save check results
      const checkData = [
        {
          delistMonitorTickerId: item.id,
          ticker: item.ticker,
          source: "sec_edgar" as const,
          signalLevel: edgar.signalLevel,
          summary: edgar.summary,
          rawData: edgar.rawData ?? undefined,
          url: edgar.url,
        },
        {
          delistMonitorTickerId: item.id,
          ticker: item.ticker,
          source: "polygon_volume" as const,
          signalLevel: volume.signalLevel,
          summary: volume.summary,
          rawData: volume.rawData ?? undefined,
          url: null,
        },
        {
          delistMonitorTickerId: item.id,
          ticker: item.ticker,
          source: "web_search" as const,
          signalLevel: webSearch.signalLevel,
          summary: webSearch.summary,
          rawData: webSearch.rawData ?? undefined,
          url: webSearch.url,
        },
        {
          delistMonitorTickerId: item.id,
          ticker: item.ticker,
          source: "ai_analysis" as const,
          signalLevel: aiAnalysis.signalLevel,
          summary: aiAnalysis.summary,
          rawData: {
            reasoning: aiAnalysis.reasoning,
            riskFactors: aiAnalysis.riskFactors,
            ...aiAnalysis.rawData,
          } as unknown as undefined,
          url: null,
        },
      ];

      await prisma.delistCheckResult.createMany({ data: checkData });

      // Compute aggregate status (worst-of across all sources)
      const aggregateStatus = worstStatus(
        edgar.signalLevel,
        volume.signalLevel,
        webSearch.signalLevel,
        aiAnalysis.signalLevel
      );

      // Update the ticker's status
      const updated = await prisma.delistMonitorTicker.update({
        where: { id: item.id },
        data: { status: aggregateStatus },
        include: {
          checkResults: { orderBy: { checkDate: "desc" }, take: 5 },
        },
      });

      results.push(updated);

      // Rate-limit pause between tickers (1s) for Polygon free tier
      if (tickers.indexOf(item) < tickers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      results,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/delist-monitor/check]", err);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}

// GET — Vercel Cron hits this daily at 6 AM ET (11:00 UTC)
export async function GET(req: Request) {
  return runChecks(req);
}

// POST — manual "Run Check" from the UI
export async function POST(req: Request) {
  return runChecks(req);
}
