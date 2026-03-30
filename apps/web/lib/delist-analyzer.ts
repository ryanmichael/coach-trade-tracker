// Delist risk analyzer — uses Claude to evaluate fund health
// Combines Polygon performance data + web search results into a risk assessment.

import Anthropic from "@anthropic-ai/sdk";
import { fetchAggregates, fetchTickerDetails } from "./polygon";

export interface PerformanceAnalysis {
  signalLevel: "green" | "yellow" | "red";
  summary: string;
  reasoning: string;
  riskFactors: string[];
  rawData: {
    priceChange30d: number | null;
    priceChange90d: number | null;
    avgVolume30d: number | null;
    fundName: string | null;
    webContext: string[];
  };
}

/**
 * Analyze an ETF's risk of poor performance / potential delisting.
 * 1. Pull 90-day price history + ticker details from Polygon
 * 2. Search web for performance concerns
 * 3. Feed everything to Claude for risk classification
 */
export async function analyzeDelistRisk(
  ticker: string,
  webSnippets: string[] = []
): Promise<PerformanceAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      signalLevel: "green",
      summary: `Analysis skipped — ANTHROPIC_API_KEY not configured`,
      reasoning: "",
      riskFactors: [],
      rawData: { priceChange30d: null, priceChange90d: null, avgVolume30d: null, fundName: null, webContext: [] },
    };
  }

  // Gather data
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const from90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [bars, details] = await Promise.all([
    fetchAggregates(ticker, 1, "day", from90d, to),
    fetchTickerDetails(ticker),
  ]);

  // Compute basic metrics
  let priceChange30d: number | null = null;
  let priceChange90d: number | null = null;
  let avgVolume30d: number | null = null;

  if (bars && bars.length >= 5) {
    const latestClose = bars[bars.length - 1].c;
    const firstClose = bars[0].c;
    priceChange90d = ((latestClose - firstClose) / firstClose) * 100;

    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const recentBars = bars.filter((b) => b.t >= thirtyDaysAgo);
    if (recentBars.length > 0) {
      priceChange30d = ((latestClose - recentBars[0].c) / recentBars[0].c) * 100;
      avgVolume30d = recentBars.reduce((sum, b) => sum + b.v, 0) / recentBars.length;
    }
  }

  // Build context for Claude
  const dataContext = [
    `Ticker: ${ticker}`,
    details ? `Fund name: ${details.name}` : null,
    details ? `Type: ${details.type}, Market: ${details.market}` : null,
    priceChange90d !== null ? `90-day price change: ${priceChange90d.toFixed(1)}%` : null,
    priceChange30d !== null ? `30-day price change: ${priceChange30d.toFixed(1)}%` : null,
    avgVolume30d !== null ? `30-day avg daily volume: ${formatVolume(avgVolume30d)}` : null,
    bars ? `Current price: $${bars[bars.length - 1].c.toFixed(2)}` : null,
    bars ? `90-day high: $${Math.max(...bars.map((b) => b.h)).toFixed(2)}` : null,
    bars ? `90-day low: $${Math.min(...bars.map((b) => b.l)).toFixed(2)}` : null,
  ].filter(Boolean).join("\n");

  const webContext = webSnippets.length > 0
    ? `\nRecent web search results about ${ticker}:\n${webSnippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
    : "\nNo recent web search results available.";

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are an ETF risk analyst. Assess whether this ETF/fund is at risk of delisting, liquidation, or severe underperformance that could lead to closure.

${dataContext}
${webContext}

Classify the risk level:
- GREEN: Fund appears healthy, normal performance, no concerns
- YELLOW: Warning signs present — significant underperformance, very low volume, declining AUM, or news suggesting the fund may be struggling
- RED: Strong evidence of imminent delisting or liquidation — SEC filings, issuer announcements, extreme volume collapse, or confirmed closure

Consider these risk factors:
- Leveraged/inverse ETFs with AUM under $50M are high closure risk
- Sustained volume decline below 50K shares/day is a warning sign
- Price decline alone doesn't mean delisting (inverse ETFs decline when their index rises)
- Reverse splits often precede delisting
- Very low share price (<$5) combined with low volume is concerning

Return ONLY valid JSON:
{
  "signal_level": "green" | "yellow" | "red",
  "summary": "One sentence summary of the risk assessment",
  "reasoning": "2-3 sentences explaining the assessment",
  "risk_factors": ["list", "of", "specific", "concerns"]
}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackResult(ticker, priceChange30d, priceChange90d, avgVolume30d, details?.name ?? null, webSnippets);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      signalLevel: parsed.signal_level ?? "green",
      summary: parsed.summary ?? `Analysis complete for ${ticker}`,
      reasoning: parsed.reasoning ?? "",
      riskFactors: parsed.risk_factors ?? [],
      rawData: {
        priceChange30d,
        priceChange90d,
        avgVolume30d,
        fundName: details?.name ?? null,
        webContext: webSnippets,
      },
    };
  } catch (err) {
    console.warn(`[Delist Analyzer] Claude API error for ${ticker}:`, err);
    return fallbackResult(ticker, priceChange30d, priceChange90d, avgVolume30d, details?.name ?? null, webSnippets);
  }
}

function fallbackResult(
  ticker: string,
  priceChange30d: number | null,
  priceChange90d: number | null,
  avgVolume30d: number | null,
  fundName: string | null,
  webSnippets: string[]
): PerformanceAnalysis {
  // Simple heuristic fallback if Claude API fails
  let signalLevel: "green" | "yellow" | "red" = "green";
  const riskFactors: string[] = [];

  if (avgVolume30d !== null && avgVolume30d < 50000) {
    signalLevel = "yellow";
    riskFactors.push(`Very low volume: ${formatVolume(avgVolume30d)}/day`);
  }
  if (priceChange90d !== null && priceChange90d < -50) {
    signalLevel = "yellow";
    riskFactors.push(`Severe 90-day decline: ${priceChange90d.toFixed(1)}%`);
  }

  return {
    signalLevel,
    summary: riskFactors.length > 0
      ? `${ticker} shows warning signs: ${riskFactors[0]}`
      : `${ticker} — no obvious risk factors detected (analysis fallback)`,
    reasoning: "Heuristic fallback — Claude API was unavailable",
    riskFactors,
    rawData: { priceChange30d, priceChange90d, avgVolume30d, fundName, webContext: webSnippets },
  };
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}
