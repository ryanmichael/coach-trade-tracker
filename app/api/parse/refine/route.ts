import { NextRequest, NextResponse } from "next/server";
import { buildParseContext, buildSeriesContext } from "@repo/agents";
import { prisma } from "@/lib/db";
import type { ParsedTradeData } from "@/lib/parser/types";

const EXTRACTION_PROMPT = `You are a trading post parser. Extract structured trade data from this coach's post.

Return ONLY valid JSON with this exact schema — no markdown, no explanation:
{
  "trades": [
    {
      "ticker": "string",
      "direction": "long" | "short",
      "priceTargetLow": number | null,
      "priceTargetHigh": number | null,
      "priceTargetPercent": number | null,
      "priceConfirmation": number | null,
      "projectedDate": "ISO date string" | null,
      "stopLoss": number | null,
      "confidence": 0.0,
      "rawExtract": "the substring or key phrase this was parsed from",
      "sourceType": "text"
    }
  ]
}

If no trade data is found, return {"trades": []}.`;

export async function POST(req: NextRequest) {
  try {
    const { content, ticker } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ trades: [], note: "ANTHROPIC_API_KEY not configured" });
    }

    // Load Coach decoder ring + optional prior series context in parallel
    let coachContext = "";
    let seriesContext = "";
    try {
      [coachContext, seriesContext] = await Promise.all([
        buildParseContext(prisma),
        ticker ? buildSeriesContext(prisma, ticker) : Promise.resolve(""),
      ]);
    } catch {
      // KB not seeded yet — proceed without context
    }

    const contextBlocks = [coachContext, seriesContext].filter(Boolean).join("\n\n");
    const systemPrompt = contextBlocks
      ? `${contextBlocks}\n\n${EXTRACTION_PROMPT}`
      : EXTRACTION_PROMPT;

    const start = Date.now();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Post to parse:\n\n"${content}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? "{}";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);
    const rawTrades: Record<string, unknown>[] = parsed.trades ?? [];

    const trades: ParsedTradeData[] = rawTrades.map((t) => ({
      ticker: String(t.ticker ?? ""),
      direction: (t.direction as "long" | "short") ?? "long",
      priceTargetLow: typeof t.priceTargetLow === "number" ? t.priceTargetLow : null,
      priceTargetHigh: typeof t.priceTargetHigh === "number" ? t.priceTargetHigh : null,
      priceTargetPercent: typeof t.priceTargetPercent === "number" ? t.priceTargetPercent : null,
      priceConfirmation: typeof t.priceConfirmation === "number" ? t.priceConfirmation : null,
      projectedDate: typeof t.projectedDate === "string" ? t.projectedDate : null,
      stopLoss: typeof t.stopLoss === "number" ? t.stopLoss : null,
      supportLevel: null,
      resistanceLevel: null,
      confidence: typeof t.confidence === "number" ? t.confidence : 0.5,
      sourceType: "text",
      rawExtract: String(t.rawExtract ?? content.slice(0, 100)),
    }));

    return NextResponse.json({ trades, processingTimeMs: Date.now() - start });
  } catch (err) {
    console.error("Refine parse error:", err);
    return NextResponse.json({ error: "Refine parse failed" }, { status: 500 });
  }
}
