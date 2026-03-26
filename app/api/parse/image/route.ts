import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import type { ImageAnalysisResult } from "@/lib/parser/types";
import { postProcessVision } from "@/lib/parser/post-process-vision";
import {
  getCoachVisionPrompt,
  getGenericVisionPrompt,
  getInverseRelationships,
  extractChartGeometry,
  buildChartData,
  type ChartData,
} from "@repo/agents";
import { prisma } from "@/lib/db";
import { fetchAggregates, type OHLCBar } from "@/lib/polygon";

// ── Levels-only ChartData fallback ───────────────────────────────────────────
// Used when geometry extraction fails or returns low confidence.
// Synthesizes a smooth price trajectory from the extracted price levels.

interface TradeLevels {
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceConfirmation: number | null;
  stopLoss: number | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
}

function buildChartDataFromLevels(
  trade: TradeLevels,
  direction: string | null,
  basePrice: number
): ChartData | null {
  const { priceTargetLow, priceTargetHigh, priceConfirmation, stopLoss, supportLevel, resistanceLevel } = trade;

  const allLevels = [
    priceTargetLow, priceTargetHigh, priceConfirmation, stopLoss,
    supportLevel, resistanceLevel, basePrice,
  ].filter((v): v is number => v !== null && v > 0);

  if (allLevels.length < 1) return null;

  let rawMin = Math.min(...allLevels);
  let rawMax = Math.max(...allLevels);

  // If all levels are the same value (e.g. only resistance extracted),
  // manufacture a ±5% range so the chart has meaningful Y-axis spread.
  if (rawMax === rawMin) {
    rawMin = rawMin * 0.95;
    rawMax = rawMax * 1.05;
  }

  const padding = (rawMax - rawMin) * 0.1;
  const yMin = Math.floor(rawMin - padding);
  const yMax = Math.ceil(rawMax + padding);

  const targetMid =
    priceTargetHigh !== null && priceTargetLow !== null
      ? (priceTargetHigh + priceTargetLow) / 2
      : priceTargetHigh ?? priceTargetLow ?? basePrice;

  const isShort = direction === "short"
    ? true
    : direction === "long"
    ? false
    : targetMid < basePrice;

  // 15-point synthetic trajectory: meander toward basePrice from the opposite side
  const numPrices = 15;
  const prices: number[] = [];
  const range = rawMax - rawMin;
  const startOffset = range * 0.06;
  const startPrice = isShort ? basePrice + startOffset : basePrice - startOffset;

  for (let i = 0; i < numPrices; i++) {
    const t = i / (numPrices - 1);
    const noise = (Math.sin(i * 2.3) * 0.012 + Math.cos(i * 1.7) * 0.008) * range;
    prices.push(startPrice + (basePrice - startPrice) * t + noise);
  }

  // 6 projected points curving toward target
  const projected: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    projected.push(basePrice + (targetMid - basePrice) * (t * t));
  }

  // X-axis labels: last N days within current month (day-level labels for recency)
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const months: string[] = [];
  // Show the past 4 days + 1 projected day — day-level labels are always more useful
  // than repeated month names since Quick Paste charts represent recent setups.
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    months.push(`${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`);
  }
  // One future date
  const future = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  months.push(`${MONTH_NAMES[future.getMonth()]} ${future.getDate()}`);

  // For watch/neutral setups (direction === null): there are no price targets — the
  // key levels are the trendline endpoints at the resolution point. Store them in
  // targetHigh/targetLow so TradeSummaryChart can render the triangle shape.
  const isWatch = direction === null;

  return {
    prices,
    projected,
    yMin,
    yMax,
    targetLow: isWatch ? (supportLevel ?? null) : priceTargetLow,
    targetHigh: isWatch ? (resistanceLevel ?? null) : priceTargetHigh,
    confirmation: priceConfirmation,
    stopLoss,
    months,
    timeWindow: null,
    channelUpper: null,
    channelLower: null,
  };
}

// ── Polygon.io OHLC → ChartData ───────────────────────────────────────────────
// Converts real historical bars into renderable ChartData.
// This is the primary chart path when a ticker is identified.

function timeframeToPolygonParams(timeframe: string | null): {
  multiplier: number;
  timespan: "minute" | "hour" | "day" | "week";
  lookbackDays: number;
} {
  switch (timeframe?.toLowerCase()) {
    case "weekly": return { multiplier: 1, timespan: "week", lookbackDays: 365 };
    case "4h":     return { multiplier: 4, timespan: "hour", lookbackDays: 30 };
    case "1h":     return { multiplier: 1, timespan: "hour", lookbackDays: 10 };
    default:       return { multiplier: 1, timespan: "day",  lookbackDays: 90 }; // daily
  }
}

function downsample(arr: number[], target: number): number[] {
  if (arr.length <= target) return arr;
  const result: number[] = [];
  for (let i = 0; i < target; i++) {
    result.push(arr[Math.round(i * (arr.length - 1) / (target - 1))]);
  }
  return result;
}

function buildChartDataFromBars(
  bars: OHLCBar[],
  trade: TradeLevels,
  direction: string | null
): ChartData {
  const TARGET_POINTS = 22;
  const closes = bars.map((b) => b.c);
  const prices = downsample(closes, TARGET_POINTS);

  const targetMid =
    trade.priceTargetHigh !== null && trade.priceTargetLow !== null
      ? (trade.priceTargetHigh + trade.priceTargetLow) / 2
      : trade.priceTargetHigh ?? trade.priceTargetLow ?? null;

  const lastPrice = prices[prices.length - 1];

  // 6-point projected path toward target
  const projected: number[] = [];
  if (targetMid !== null) {
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      projected.push(lastPrice + (targetMid - lastPrice) * (t * t));
    }
  }

  // Y-axis viewport: all real prices + all trade levels + 8% padding
  const allValues = [
    ...prices,
    ...(projected.length ? projected : []),
    trade.priceTargetLow,
    trade.priceTargetHigh,
    trade.priceConfirmation,
    trade.stopLoss,
  ].filter((v): v is number => v !== null && v > 0);

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const pad = (rawMax - rawMin) * 0.08;
  const yMin = Math.floor(rawMin - pad);
  const yMax = Math.ceil(rawMax + pad);

  // X-axis labels: evenly spaced dates from bar timestamps
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const labelCount = 6;
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round(i * (bars.length - 1) / (labelCount - 1))
  );
  const months = labelIndices.map((idx) => {
    const d = new Date(bars[idx].t);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  });

  // Pattern detection from direction + price relationships
  // (no geometry pass needed — levels + direction are sufficient for patternType)
  const isShort = direction === "short" || direction === "bearish";
  const patternType: ChartData["patternType"] =
    isShort && trade.priceTargetLow !== null && trade.priceConfirmation !== null
      ? "distribution"
      : null;

  const wyckoffKeyPoints = patternType === "distribution"
    ? {
        bc: trade.resistanceLevel ?? trade.priceConfirmation ?? lastPrice,
        ar: trade.supportLevel ?? lastPrice * 0.97,
        ut: null,
        lpsy: trade.priceConfirmation,
        sow: trade.priceTargetLow,
        currentPhase: (lastPrice <= (trade.supportLevel ?? lastPrice * 0.97) ? "breakdown" : "distribution") as "distribution" | "breakdown",
      }
    : null;

  return {
    prices,
    projected,
    yMin,
    yMax,
    targetLow: trade.priceTargetLow,
    targetHigh: trade.priceTargetHigh,
    confirmation: trade.priceConfirmation,
    stopLoss: trade.stopLoss,
    months,
    timeWindow: null,
    channelUpper: null,
    channelLower: null,
    patternType,
    wyckoffKeyPoints,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_ANALYSIS: ImageAnalysisResult = {
  imageType: "other",
  ticker: null,
  priceLevels: [],
  annotations: [],
  timeframe: null,
  direction: null,
  projectedDates: [],
  confidence: 0,
  summary: "Image analysis unavailable — ANTHROPIC_API_KEY not configured",
};

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = "image/jpeg", detect = false, focusTicker } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.startsWith("your-")) {
      return NextResponse.json({
        analysis: EMPTY_ANALYSIS,
        inverseRelationships: [],
        processingTimeMs: 0,
      });
    }

    const validMediaType = (mediaType as string).startsWith("image/")
      ? (mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif")
      : "image/jpeg";

    // ── Detection-only pass (cheap Haiku call) ─────────────────────────────
    // Called before the full analysis to ask the user which panel to analyze.
    if (detect) {
      const detectRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: validMediaType, data: imageBase64 } },
              { type: "text", text: 'How many distinct stock tickers are shown in this image? They may be in separate panels or overlaid on the same chart. List each ticker symbol. Return ONLY valid JSON: {"panel_count": number, "tickers": ["string"]}' },
            ],
          }],
        }),
      });

      if (!detectRes.ok) {
        const errBody = await detectRes.json().catch(() => ({}));
        console.error("[ImageRoute detect] Anthropic error:", detectRes.status, errBody);
        return NextResponse.json({ panel_count: 1, tickers: [] });
      }

      const detectData = await detectRes.json();
      const detectText: string = detectData.content?.[0]?.text ?? "{}";
      const detectJson = detectText.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
      const detectParsed = JSON.parse(detectJson);
      console.log("[ImageRoute detect] panels:", detectParsed);
      return NextResponse.json({
        panel_count: detectParsed.panel_count ?? 1,
        tickers: detectParsed.tickers ?? [],
      });
    }

    // ── Full analysis pass ─────────────────────────────────────────────────

    // Load Coach-specific Vision prompt; fall back to generic if DB unavailable
    let visionPrompt: string;
    try {
      visionPrompt = await getCoachVisionPrompt(prisma);
    } catch {
      visionPrompt = getGenericVisionPrompt();
    }

    const start = Date.now();

    // NLP vision pass — primary analysis (price levels, ticker, direction)
    const nlpResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: visionPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: validMediaType, data: imageBase64 },
              },
              {
                type: "text",
                text: focusTicker
                  ? `This image may contain multiple chart panels. Focus your analysis ONLY on the ${focusTicker} panel — ignore all other panels. Read every price label on the y-axis, every drawn horizontal line, every annotation, and every piece of text on the ${focusTicker} chart. Return the complete JSON.`
                  : "Analyze this chart image thoroughly. Read every price label on the y-axis, every drawn horizontal line, every annotation, and every piece of text visible on the chart. Return the complete JSON.",
              },
            ],
          },
        ],
      }),
    });

    if (!nlpResponse.ok) {
      const errBody = await nlpResponse.json().catch(() => ({}));
      console.error("[ImageRoute] Anthropic API error:", nlpResponse.status, JSON.stringify(errBody));
      throw new Error(`Anthropic API error: ${nlpResponse.status} — ${errBody?.error?.message ?? JSON.stringify(errBody)}`);
    }

    const nlpData = await nlpResponse.json();
    const rawText: string = nlpData.content?.[0]?.text ?? "{}";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);

    console.log("[ImageRoute] raw model response:", JSON.stringify({
      direction: parsed.direction,
      price_levels: parsed.price_levels,
      confidence: parsed.confidence,
      y_axis_ticks: parsed.y_axis_ticks ?? [],
    }));

    type PriceLevelType = "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown";
    const priceLevels: { value: number; type: PriceLevelType; label: string | null }[] =
      (parsed.price_levels ?? []).map(
        (l: { value: number; type: string; label: string | null }) => ({
          value: l.value,
          type: (l.type as PriceLevelType) ?? "unknown",
          label: l.label,
        })
      );

    // Post-process: direction correction, support-breakdown detection, level reclassification
    const annotations: string[] = parsed.annotations ?? [];
    const postProcessed = postProcessVision({
      direction: parsed.direction ?? null,
      priceLevels,
      annotations,
    });

    if (postProcessed.correctedDirection !== (parsed.direction ?? null)) {
      console.log(`[ImageRoute] direction corrected: ${parsed.direction} → ${postProcessed.correctedDirection}${postProcessed.supportBreakdownOverride ? " (support-breakdown)" : ""}`);
    }

    const analysis: ImageAnalysisResult = {
      imageType: parsed.image_type ?? "other",
      ticker: parsed.ticker ?? null,
      priceLevels: postProcessed.reclassifiedLevels,
      annotations,
      timeframe: parsed.timeframe ?? null,
      direction: postProcessed.correctedDirection,
      projectedDates: parsed.projected_dates ?? [],
      confidence: parsed.confidence ?? 0,
      summary: parsed.summary ?? "",
    };

    // Build ChartData — priority: Polygon real data > geometry > levels-only
    const levels = analysis.priceLevels;
    const targetLevels = levels.filter((l) => l.type === "target").map((l) => l.value);
    const trade = {
      priceTargetLow: targetLevels.length ? Math.min(...targetLevels) : null,
      priceTargetHigh: targetLevels.length ? Math.max(...targetLevels) : null,
      priceConfirmation: levels.find((l) => l.type === "entry")?.value ?? null,
      stopLoss: levels.find((l) => l.type === "stop_loss")?.value ?? null,
      supportLevel: levels.find((l) => l.type === "support")?.value ?? null,
      resistanceLevel: levels.find((l) => l.type === "resistance")?.value ?? null,
    };
    const proxyPrice =
      trade.priceConfirmation ??
      (trade.priceTargetHigh !== null && trade.priceTargetLow !== null
        ? (trade.priceTargetHigh + trade.priceTargetLow) / 2
        : trade.priceTargetHigh ?? trade.priceTargetLow ??
          trade.supportLevel ?? trade.resistanceLevel ?? 0);

    let chartData: ChartData | null = null;
    let usedPolygon = false;

    // ── Primary: Polygon.io real OHLC data ─────────────────────────────────────
    if (analysis.ticker) {
      try {
        const { multiplier, timespan, lookbackDays } = timeframeToPolygonParams(analysis.timeframe);
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - lookbackDays);
        const fmt = (d: Date) => d.toISOString().split("T")[0];
        const bars = await fetchAggregates(analysis.ticker, multiplier, timespan, fmt(fromDate), fmt(toDate));
        if (bars && bars.length >= 5) {
          // Direction sanity check: compare Vision's target direction against Polygon current price
          const currentPrice = bars[bars.length - 1].c;
          const mainTarget = trade.priceTargetHigh ?? trade.priceTargetLow;
          if (mainTarget && currentPrice > 0 && analysis.direction) {
            const pctDiff = ((mainTarget - currentPrice) / currentPrice) * 100;
            if (analysis.direction === "bullish" && pctDiff < -20) {
              console.warn(`[ImageRoute] Direction sanity fail: bullish but target ${mainTarget} is ${pctDiff.toFixed(1)}% below current ${currentPrice} — flagging`);
              analysis.summary += ` [⚠️ Direction-price mismatch: target is ${Math.abs(pctDiff).toFixed(0)}% below current price]`;
            } else if (analysis.direction === "bearish" && pctDiff > 20) {
              console.warn(`[ImageRoute] Direction sanity fail: bearish but target ${mainTarget} is +${pctDiff.toFixed(1)}% above current ${currentPrice} — flagging`);
              analysis.summary += ` [⚠️ Direction-price mismatch: target is ${pctDiff.toFixed(0)}% above current price]`;
            }
          }

          const normalizedDir = analysis.direction === "bearish" ? "short"
            : analysis.direction === "bullish" ? "long" : null;
          chartData = buildChartDataFromBars(bars, trade, normalizedDir);
          usedPolygon = true;
          console.log(`[ChartViz] Polygon path: ${bars.length} ${multiplier}${timespan} bars for ${analysis.ticker}, yMin=${chartData.yMin} yMax=${chartData.yMax}`);
        }
      } catch (err) {
        console.warn("[ChartViz] Polygon fetch failed, falling back to geometry:", err);
      }
    }

    // ── Fallback: Vision geometry shape extraction ─────────────────────────────
    if (!usedPolygon) {
      const geometry = await extractChartGeometry(imageBase64, validMediaType, visionPrompt).catch(() => null);
      if (geometry && geometry.confidence >= 0.5 && geometry.priceShape.length >= 5) {
        try {
          chartData = buildChartData(geometry, trade, proxyPrice);
          console.log("[ChartViz] geometry chartData generated, prices:", chartData.prices.length);
        } catch {
          // fall through to levels-only
        }
      }

      // ── Last resort: synthesize from levels alone ───────────────────────────
      if (!chartData) {
        const normalizedDir =
          analysis.direction === "bearish" ? "short"
          : analysis.direction === "bullish" ? "long"
          : null;
        const effectiveBase = proxyPrice > 0 ? proxyPrice : Math.max(...[
          trade.supportLevel, trade.resistanceLevel,
        ].filter((v): v is number => v !== null && v > 0), 0);
        if (effectiveBase > 0) {
          chartData = buildChartDataFromLevels(trade, normalizedDir, effectiveBase);
          console.log("[ChartViz] levels-only fallback:", chartData ? `yMin=${chartData.yMin} yMax=${chartData.yMax} prices=${chartData.prices.length}` : "null");
        }
      }
    }

    // Step-down pattern override: geometry identified step_down → force bearish.
    // Step-down is inherently bearish (descending stair-step with resistance ceiling).
    if (chartData?.patternType === "step_down" && analysis.direction !== "bearish") {
      console.log(`[ImageRoute] step_down pattern detected by geometry — overriding direction ${analysis.direction} → bearish`);
      analysis.direction = "bearish";
    }

    // Post-process: for watch/neutral setups, ensure targetHigh/targetLow carry the
    // trendline endpoint prices regardless of which chart path ran above.
    // The geometry path sets targetHigh/targetLow from priceTargetHigh/priceTargetLow
    // (which are null for watch) — override them with the extracted resistance/support.
    if (chartData && analysis.direction === "neutral" && (trade.resistanceLevel || trade.supportLevel)) {
      chartData = {
        ...chartData,
        targetHigh: trade.resistanceLevel ?? chartData.targetHigh,
        targetLow: trade.supportLevel ?? chartData.targetLow,
      };
    }

    // Clear time window when there are no projected dates — prevents distribution-phase
    // vertical lines from being misread as price target windows.
    if (chartData && analysis.projectedDates.length === 0) {
      chartData = { ...chartData, timeWindow: null };
    }

    // Expand y-range to include all significant price levels so projected lines
    // don't exit the bottom/top of the chart area.
    if (chartData) {
      const allSignificantPrices = [
        trade.priceTargetLow,
        trade.priceTargetHigh,
        trade.stopLoss,
      ].filter((v): v is number => v !== null && v > 0);
      if (allSignificantPrices.length > 0) {
        const levelMin = Math.min(...allSignificantPrices);
        const levelMax = Math.max(...allSignificantPrices);
        if (levelMin < chartData.yMin) {
          chartData = { ...chartData, yMin: Math.floor(levelMin * 0.97) };
        }
        if (levelMax > chartData.yMax) {
          chartData = { ...chartData, yMax: Math.ceil(levelMax * 1.03) };
        }
      }
    }

    // Post-process: look up inverse ETF relationships
    let inverseRelationships: Awaited<ReturnType<typeof getInverseRelationships>> = [];
    if (analysis.ticker) {
      try {
        inverseRelationships = await getInverseRelationships(prisma, analysis.ticker);
      } catch {
        // KB not seeded yet — non-fatal
      }
    }

    // Parse multi-panel data if model returned it
    type RawPanel = {
      ticker?: string | null;
      price_levels?: { value: number; type: string; label: string | null }[];
      direction?: "bullish" | "bearish" | "neutral" | null;
      confidence?: number;
      summary?: string;
    };
    const panels: Array<{
      ticker: string | null;
      priceLevels: { value: number; type: string; label: string | null }[];
      direction: "bullish" | "bearish" | "neutral" | null;
      confidence: number;
      summary: string;
    }> | null =
      Array.isArray(parsed.panels) && parsed.panels.length > 1
        ? (parsed.panels as RawPanel[]).map((p) => ({
            ticker: p.ticker ?? null,
            priceLevels: (p.price_levels ?? []).map((l) => ({
              value: l.value,
              type: l.type ?? "unknown",
              label: l.label ?? null,
            })),
            direction: p.direction ?? null,
            confidence: p.confidence ?? 0,
            summary: p.summary ?? "",
          }))
        : null;

    return NextResponse.json({
      analysis,
      // Don't return panels when focusTicker is set — user already chose, chartData always present
      panels: focusTicker ? null : panels,
      chartData,
      inverseRelationships,
      processingTimeMs: Date.now() - start,
    });
  } catch (err) {
    console.error("Image analysis error:", err);
    return NextResponse.json(
      { error: "Image analysis failed" },
      { status: 500 }
    );
  }
}
