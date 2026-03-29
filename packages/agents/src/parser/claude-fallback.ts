/**
 * Claude Text Fallback — calls Claude Sonnet for structured trade extraction
 * when the regex pipeline returns confidence < 0.7.
 *
 * Uses buildParseContext() for Coach-aware parsing and buildSeriesContext()
 * for ticker-specific inheritance.
 */

import type { PrismaClient } from "@repo/db";
import { buildParseContext, buildSeriesContext } from "../coach-intelligence/context-builder";

export interface FallbackTradeData {
  ticker: string;
  direction: "long" | "short";
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceTargetPercent: number | null;
  priceConfirmation: number | null;
  projectedDate: string | null;
  stopLoss: number | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
  confidence: number;
  sourceType: "text";
  rawExtract: string;
}

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

export class ClaudeFallback {
  private db: PrismaClient | null;
  private apiKey: string | null;

  constructor(db?: PrismaClient, apiKey?: string) {
    this.db = db ?? null;
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  }

  /**
   * Parse post content using Claude Sonnet with Coach context.
   * Returns structured trade data with higher confidence than regex alone.
   */
  async parse(content: string, ticker?: string): Promise<FallbackTradeData[]> {
    if (!this.apiKey || this.apiKey.startsWith("your-")) {
      return [];
    }

    // Load Coach context — gracefully degrade if DB unavailable
    let coachContext = "";
    let seriesContext = "";
    if (this.db) {
      try {
        [coachContext, seriesContext] = await Promise.all([
          buildParseContext(this.db),
          ticker ? buildSeriesContext(this.db, ticker) : Promise.resolve(""),
        ]);
      } catch {
        // KB not seeded — proceed without context
      }
    }

    const contextBlocks = [coachContext, seriesContext].filter(Boolean).join("\n\n");
    const systemPrompt = contextBlocks
      ? `${contextBlocks}\n\n${EXTRACTION_PROMPT}`
      : EXTRACTION_PROMPT;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: `Post to parse:\n\n"${content}"` }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const rawText: string = data.content?.[0]?.text ?? "{}";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const rawTrades: Record<string, unknown>[] = parsed.trades ?? [];

    return rawTrades.map((t) => ({
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
      sourceType: "text" as const,
      rawExtract: String(t.rawExtract ?? content.slice(0, 100)),
    }));
  }
}
