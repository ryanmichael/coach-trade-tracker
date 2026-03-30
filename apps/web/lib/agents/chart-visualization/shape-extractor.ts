/**
 * Shape Extractor
 *
 * Sends a chart image to Claude Vision with a specialized geometry-extraction
 * prompt. Returns a ChartGeometry object (normalized shapes, pattern, timeframe).
 *
 * This is separate from the NLP/Parser Vision pass (which extracts price levels,
 * ticker, and direction). This pass extracts the SHAPE of price action.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ChartGeometry } from "./types";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const SHAPE_EXTRACTION_PROMPT = `You are a chart geometry extractor for a trading dashboard. Analyze this chart image.

Your job is NOT to identify exact prices (another system does that).
Your job IS to extract the SHAPE and TRAJECTORY of the price action.

Return ONLY valid JSON matching this exact schema:
{
  "priceShape": [number, ...],
  "channelUpper": [number, ...] | null,
  "channelLower": [number, ...] | null,
  "yAxisMin": number | null,
  "yAxisMax": number | null,
  "pattern": "ascending_channel" | "descending_channel" | "broadening_top" | "distribution" | "accumulation" | "head_and_shoulders" | "double_top" | "double_bottom" | "flag" | "triangle" | "range" | "step_down" | null,
  "timeframe": "daily" | "4H" | "1H" | "weekly" | null,
  "dateRange": { "start": "ISO date string", "end": "ISO date string" } | null,
  "projectedTimeframe": {
    "earliest": "ISO date string",
    "latest": "ISO date string",
    "label": "string"
  } | null,
  "confidence": number,
  "stepDownData": {
    "diagonalStart": number,
    "diagonalEnd": number,
    "zones": [{ "upper": number, "lower": number }]
  } | null,
  "triangleData": {
    "subtype": "symmetrical" | "ascending" | "descending",
    "upperTrendline": { "startPrice": number, "endPrice": number },
    "lowerTrendline": { "startPrice": number, "endPrice": number },
    "swingPoints": [{ "xFraction": number, "price": number, "type": "high" | "low" }],
    "apexPrice": number,
    "apexXFraction": number
  } | null
}

Rules:
- priceShape: 15–25 values between 0.0 and 1.0. 0.0 = lowest price visible on the chart, 1.0 = highest price visible. Capture the TREND, not every wiggle — smooth it to show the main trajectory a trader's eye would follow.
- yAxisMin: the LOWEST price tick label visible on the y-axis (a number, e.g. 50.0). This is the actual dollar price at normalized position 0.0. Return null only if the y-axis has no price labels at all.
- yAxisMax: the HIGHEST price tick label visible on the y-axis (a number, e.g. 51.0). This is the actual dollar price at normalized position 1.0. Return null only if the y-axis has no price labels at all.
- channelUpper / channelLower: if the chart shows an ascending/descending channel, broadening pattern, or wedge, extract boundary arrays at the same 0–1 scale and same length as priceShape. Return null if no clear channel.
- pattern: the dominant chart formation. Return null if ambiguous. Use EXACTLY one of the enum strings listed above — no spaces, no variants.
- timeframe: chart bar size. Return null if unclear.
- dateRange: earliest and latest dates visible on the x-axis. Return null if no dates visible.
- projectedTimeframe: your best estimate of when price will reach the annotated target zone. Use any annotation arrows, projected paths, or x-axis date labels near the target to estimate this. Return null if insufficient information.
- confidence: 0.0–1.0 score for the quality of this extraction. Use 0.0–0.49 if the chart is unclear, blurry, or non-standard. Use 0.5–0.79 for reasonable extraction. Use 0.8–1.0 for clear, well-annotated charts.
- stepDownData: ONLY populate when pattern is "step_down". Otherwise null.
  CRITICAL: Use ACTUAL DOLLAR PRICES read from the Y-axis for ALL stepDownData values — NOT normalized 0–1.
  Read the Y-axis tick labels carefully and interpolate between them to determine the exact price at each zone boundary and diagonal endpoint.
  - diagonalStart: the PRICE (in dollars, read from the Y-axis) where the diagonal resistance trendline begins at the LEFT edge of the chart.
  - diagonalEnd: the PRICE (in dollars) where the diagonal resistance trendline ends at the RIGHT edge of the chart.
  - zones: array of horizontal consolidation boxes ordered from HIGHEST (oldest) to LOWEST (most recent). Each zone has "upper" (price at top of box) and "lower" (price at bottom of box). Read these from the Y-axis carefully. Extract ALL visible zones — count every distinct flat/shaded rectangular region. There may be 2, 3, or more. A zone is any horizontal range where price consolidates sideways between sharp drops. Even if two zones share a similar visual style (e.g., both are shaded blue), they are SEPARATE zones if they are at DIFFERENT price levels with a sharp drop between them.

- triangleData: ONLY populate when pattern is "triangle". Otherwise null.
  CRITICAL: Use ACTUAL DOLLAR PRICES read from the Y-axis for ALL triangleData price values.
  - subtype: "symmetrical" if BOTH trendlines converge (upper descends, lower ascends at roughly equal angles); "ascending" if the UPPER trendline is flat/horizontal while the lower ascends; "descending" if the LOWER trendline is flat/horizontal while the upper descends.
  - upperTrendline.startPrice: the PRICE where the upper trendline begins (first swing high, left side).
  - upperTrendline.endPrice: the PRICE where the upper trendline ends (at or near the apex).
  - lowerTrendline.startPrice: the PRICE where the lower trendline begins (first swing low, left side).
  - lowerTrendline.endPrice: the PRICE where the lower trendline ends (at or near the apex).
  - swingPoints: array of alternating high/low swing points that define the triangle, ordered LEFT to RIGHT. Each has xFraction (0.0 = chart left edge, 1.0 = chart right edge), price (dollar value from Y-axis), and type ("high" or "low"). Extract ALL visible numbered swing points (typically 4–5). If the chart labels them 1,2,3,4,5 — extract all of them.
  - apexPrice: the dollar price where the upper and lower trendlines converge (or would converge if extended).
  - apexXFraction: the x-position (0.0–1.0) where the apex occurs. May exceed 1.0 if the apex is projected beyond the visible chart area.

Pattern selection guide — pick the FIRST description that clearly fits:
- "flag": A sharp directional move (the pole) occupies the LEFT ~15–25% of the chart, followed by a brief consolidating channel (the flag body) for the remaining RIGHT portion. Both the pole and flag must be visible. Bull flag = descending consolidation after upward pole. Bear flag = ascending consolidation after downward pole.
- "head_and_shoulders": Three peaks where the MIDDLE peak is clearly the highest. The two outer peaks (shoulders) are at a similar, lower level. A neckline connects the two troughs between shoulder-head and head-shoulder.
- "double_top": Exactly TWO peaks at nearly the same price level, with a trough between them. Price fails to break higher on the second attempt.
- "double_bottom": Exactly TWO troughs at nearly the same price level, with a peak between them. Price bounces from the same support twice.
- "broadening_top": A megaphone / expanding pattern — progressively HIGHER highs AND LOWER lows, causing the two trendlines to DIVERGE. At least 4–5 alternating swing points. Sometimes labeled with numbered points (1,2,3,4,5).
- "distribution": Wyckoff topping pattern. Range-bound trading area with a high at the left edge (Buying Climax), a reaction low (Automatic Reaction), and declining highs (LPSY) before breakdown. May have labels like BC, AR, UT, LPSY, SOW. Choose this over "range" when Wyckoff labels are present.
- "accumulation": Wyckoff bottoming pattern. Range-bound with a selling climax at the left, spring near the lows, then signs of strength. May have labels like SC, AR, Spring, SOS. Choose this over "range" when Wyckoff labels are present.
- "ascending_channel": A gradual, sustained uptrend with roughly PARALLEL upper and lower trendlines over the full chart span. No sharp pole at the start. Both boundaries slope upward at similar angles.
- "descending_channel": A gradual, sustained downtrend with roughly PARALLEL trendlines sloping downward. No sharp pole at the start.
- "triangle": Converging trendlines — upper trendline descends, lower trendline ascends (symmetric), or one is flat (ascending/descending wedge). Price range narrows toward an apex.
- "step_down": A bearish stair-step pattern — an OVERALL descending trendline (drawn diagonally across the full chart) combined with 2 or more FLAT horizontal consolidation zones ("steps") stacked at progressively lower price levels. Each step is a distinct sideways channel separated from the next by a sharp nearly-vertical drop. The entire structure resembles descending stair steps beneath a declining trendline. Key visual clues: (1) a long diagonal line sloping from upper-left to lower-right covering the full chart span, (2) rectangular highlighted/shaded boxes at different price levels, each roughly horizontal, (3) sharp drops between boxes.
- "range": Sideways consolidation that doesn't clearly fit any pattern above. Horizontal support and resistance with price oscillating between them.
- null: The chart is ambiguous, blurry, or does not show a recognizable price pattern.`;

/**
 * Extract chart geometry from a base64-encoded image.
 *
 * @param imageBase64 - Base64 image data (without the data: prefix)
 * @param mediaType - MIME type: "image/png" | "image/jpeg" | "image/webp" | "image/gif"
 * @param coachContext - Coach chart style fingerprint from buildVisionContext()
 * @returns Parsed ChartGeometry, or null if the image is not a chart or extraction fails
 */
export async function extractChartGeometry(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
  coachContext: string
): Promise<ChartGeometry | null> {
  const systemPrompt = coachContext
    ? `${coachContext}\n\n${SHAPE_EXTRACTION_PROMPT}`
    : SHAPE_EXTRACTION_PROMPT;

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Extract the chart geometry as specified. Return only the JSON object.",
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

    const parsed = JSON.parse(cleaned) as ChartGeometry;

    // Validate priceShape is present and within bounds
    if (!Array.isArray(parsed.priceShape) || parsed.priceShape.length < 5) {
      return null;
    }

    // Normalize pattern — reject any value not in the known enum.
    // Vision occasionally returns variants like "descending channel" (space) or
    // "flag_pattern" (extra suffix). Silently falling through to a generic chart
    // is confusing; better to null it so the fallback is intentional.
    const VALID_PATTERNS = new Set([
      "ascending_channel", "descending_channel", "broadening_top",
      "distribution", "accumulation", "head_and_shoulders",
      "double_top", "double_bottom", "flag", "triangle", "range", "step_down",
    ]);
    if (parsed.pattern !== null && parsed.pattern !== undefined && !VALID_PATTERNS.has(parsed.pattern)) {
      console.warn(`[ChartViz] unknown pattern "${parsed.pattern}" from Vision — setting to null`);
      parsed.pattern = null;
    }

    return parsed;
  } catch (err) {
    console.error("[ChartViz] shape extraction failed:", err);
    return null;
  }
}
