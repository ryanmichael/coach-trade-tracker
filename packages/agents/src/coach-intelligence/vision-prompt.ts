/**
 * Vision Prompt module
 * Generates the Coach-specific Vision prompt for Claude image analysis.
 *
 * Replaces the generic image analysis prompt in the NLP Parser.
 * Dynamically injects current Coach Profile values (bias, chart style,
 * methodology) so Vision knows exactly what to look for in Coach's charts.
 */

import type { PrismaClient } from "@repo/db";
import { loadProfile } from "./coach-profile";
import { buildVisionContext } from "./context-builder";

/**
 * Returns the full Coach-specific Vision prompt.
 *
 * The prompt has two parts:
 * 1. The Coach chart style fingerprint (from buildVisionContext) — prepended as context
 * 2. The analysis instructions — tailored to Coach's current bias and methodology
 *
 * Pass this as the complete prompt (system + user content) to the Claude Vision call.
 */
export async function getCoachVisionPrompt(db: PrismaClient): Promise<string> {
  const [profile, visionContext] = await Promise.all([
    loadProfile(db),
    buildVisionContext(db),
  ]);

  const { bias, methodology, chartStyle } = profile;

  const biasSection =
    bias.current.toLowerCase() === "bearish"
      ? `CONTEXT — COACH'S GENERAL BIAS IS BEARISH:
Coach frequently posts bearish/short setups. Use this as a tiebreaker ONLY when the chart is ambiguous.

IMPORTANT: The "direction" field must reflect what THIS SPECIFIC CHART visually shows — not Coach's general bias.
- If the chart shows a V-shaped recovery, price rising, or upward arrows → direction = "bullish"
- If price is currently BELOW annotated target levels → those levels are targets ABOVE current price (long setup)
- If price is currently ABOVE annotated target levels → those levels are targets BELOW current price (short setup)
- A cluster of dashed lines above current price = price target zone → classify as "target", not "resistance"
- A cluster of dashed lines below current price = price target zone for shorts → classify as "target"

Wyckoff context (use when chart structure matches):
- Distribution patterns (PSY → BC → AR → ST → SOW → LPSY) → bearish, short targets below
- Accumulation patterns (PS → SC → AR → ST → Spring → SOS → LPS) → bullish, long targets above`
      : `CONTEXT — COACH BIAS: ${bias.current.toUpperCase()}
Coach tends toward ${bias.current} setups. Use as a tiebreaker only when the chart direction is ambiguous.
Always let the chart's visual structure determine direction first.`;

  return `${visionContext}

You are a trading chart analyst specialized in ${methodology.primary.toUpperCase()} methodology.
Analyze this image from a day trading coach who uses ${chartStyle.platform} for charting.

${biasSection}

Identify and extract ALL of the following:

0. Y-AXIS SCALE (DO THIS FIRST — before anything else)
   CRITICAL: Read EVERY numeric label on the Y-axis (right or left side of chart).
   Record them as an ordered list from bottom to top. Note the min, max, and interval.
   You MUST output these in the "y_axis_ticks" field so we can validate your scale reading.
   ALL subsequent price level readings depend on this step being accurate.

1. TICKER SYMBOL
   - Check chart header, watermark, title, axis labels, and any visible text
   - If multiple tickers visible, return the primary one in "ticker" field
   - If multiple chart panels, note each ticker

2. ALL PRICE LEVELS ON THE CHART — use the Y-axis scale you read in step 0
   CRITICAL STEP: Before identifying any price levels, read EVERY tick label on the Y-axis (right or left side). Note the min, max, and interval so you can interpolate the exact price of any line by its Y-position.
   - Horizontal lines (any color — ${chartStyle.annotationColor} = likely target or entry)
   - Dashed lines (projected support/resistance)
   - Annotated price numbers written directly on the chart
   - Arrow endpoints (where arrows point = key level)
   - UNLABELED LINES: For any drawn horizontal line with no direct price label, calculate its value by interpolating its Y pixel position against the Y-axis scale you read above. NEVER skip a line because it lacks a label — use the scale to derive the value.
   - Include the current price (last candle close) as a level of type "entry" if no explicit entry is marked
   - MULTIPLE DISTINCT ZONES: When the chart has multiple distinctly colored or shaded zones at DIFFERENT price levels, extract EACH zone as a SEPARATE level entry — do not merge them. A pink/red shaded rectangle and a blue dashed band at different levels are two separate levels.
   - TIERED TARGETS: When there are multiple annotated zones above current price in a bullish setup (or below in bearish), classify ALL of them as "target" type. The merge logic will assign the lower one as near-term target and the higher one as the extended target automatically.
   - TARGET ZONE CLASSIFICATION: A band of closely-spaced parallel dashed lines at a consistent price range = a price TARGET ZONE. Classify it as "target" with the explicitly labeled value (e.g., "116" written next to blue dashed lines → value=116, type="target").
   - LABELED ZONES: When a price zone (shaded rectangle or band of lines) has an explicit large numeric label written beside it (e.g., "102", "116"), that number IS the level value — use it exactly.
   - BULLISH SETUP RULE: In a bullish chart, annotated colored zones ABOVE current price are TARGETS, not resistance. A pink zone at 102 and a blue zone at 116 above current price = two targets, not resistance levels.
   - BEARISH SETUP RULE: In a bearish chart, annotated colored zones BELOW current price are TARGETS, not support.
   - GAP FILL TARGETS: Coach frequently references "gap fills" — a price returning to a level before a previous gap. If a visible gap exists on the chart (space between candles with no trading), the opposite edge of the gap is a likely target. Look for annotations like "gap fill", "fill the gap", or arrows pointing into visible gaps.
   - SUPPORT/RESISTANCE FLIP AT MOVING AVERAGES: When price crosses a key moving average (50-day, 200-day), the MA often flips role — former support becomes resistance and vice versa. If a moving average line is visible and price recently crossed it, note the flip.
   - For EACH level, classify as: target, support, resistance, entry, stop_loss, or unknown

3. TEXT ANNOTATIONS
   - Read every piece of text the coach wrote on the chart
   - Include arrows with labels, circled text, written price labels
   - Include any Wyckoff phase labels (e.g., "BC", "SOW", "LPSY")

4. CHART TIMEFRAME
   - Read the timeframe selector or x-axis label (daily, 4H, 1H, weekly, etc.)

5. TRADE DIRECTION — derive from level positions and chart annotations
   PRIMARY RULE: direction = where the TARGETS are relative to the ENTRY/CONFIRMATION level
   - If price targets are ABOVE the confirmation/entry level → direction = "bullish" (long setup)
   - If price targets are BELOW the confirmation/entry level → direction = "bearish" (short setup)
   - If no explicit target is annotated, use arrow directions or channel slope
   - IGNORE the historical trend shown in the chart history (a chart showing a prior drop followed by a bounce at the bottom with targets above = BULLISH setup)
   - Coach's general bias is irrelevant for this field — it must reflect THIS specific setup

   STEP-DOWN / DESCENDING STAIR-STEP — identify and classify BEFORE applying general rules:
   When the chart shows ALL of:
   (a) A diagonal trendline descending from upper-left to lower-right spanning the FULL chart width, AND
   (b) Two or more FLAT (horizontal) rectangular highlighted/shaded zones at progressively LOWER price levels, AND
   (c) Sharp nearly-vertical drops connecting the zones:
   → This is a STEP-DOWN continuation pattern. Classify direction = "bearish".
   → The diagonal line is a RESISTANCE CEILING — it is NOT a price target. Classify all points on the diagonal line as "resistance".
   → Do NOT classify the diagonal trendline's value as "target" even if that value is above current price.
   → EXTRACT EVERY ZONE BOUNDARY: For each flat consolidation box, read the Y-axis to determine the exact upper and lower price of that zone. Add BOTH boundaries as separate price_levels entries:
     - The upper boundary of each zone → type "resistance", label "Step N upper" (N = 1 for highest zone, 2 for next, etc.)
     - The lower boundary of each zone → type "support", label "Step N lower"
   → The lower boundary of the CURRENT (lowest/most recent) flat zone is the confirmation/breakdown level — also add it as type "entry".
   → EXTRACT DIAGONAL ENDPOINTS: Read the Y-axis price where the diagonal resistance line starts (left edge) and ends (right edge). Add both as type "resistance", labeled "Diagonal start" and "Diagonal end".
   → Target = below the current step's lower boundary. If no explicit target is labeled below, set no target.
   → A dashed vertical line at the right of the chart indicates the projected timing of the next breakdown, not a price level.

   SUPPORT BREAKDOWN / BEARISH SETUP — recognize this pattern:
   - When an annotation explicitly labels a price level as "CRITICAL SUPPORT", "KEY SUPPORT", or just "SUPPORT" AND the current price is AT or BELOW that labeled level, this is a BEARISH setup (the support was broken from above)
   - In this case: classify the labeled support level as "resistance" (broken support now acts as resistance), the current price as "entry", and direction = "bearish"
   - Example: annotation "7400 CRITICAL SUPPORT" with current price at 7317 → entry=7317, resistance=7400, direction="bearish"
   - A channel that historically slopes upward does NOT make a setup bullish if price just broke below a labeled critical support within that channel

   KEEP WATCH — use direction = "neutral" when the setup is genuinely bidirectional:
   - Symmetrical triangle, wedge, or pennant AT OR NEAR the apex — price must resolve but direction is unconfirmed
   - Two arrows explicitly drawn in OPPOSITE directions from the same price level (one up arrow AND one down arrow)
   - Annotations like "watch for break above X / below Y" or "could go either way"
   - Chart shows labeled price scenarios for BOTH a bullish breakout AND a bearish breakdown with equal visual emphasis
   - The coach is alerting to a PENDING decision, not calling a direction yet

   CONVERGING TRENDLINE / TRIANGLE EXTRACTION — CRITICAL:
   When two trendlines converge (symmetrical triangle, ascending/descending triangle, wedge), the breakout price is TIME-DEPENDENT — the upper and lower lines are moving toward each other and the breakout level changes each day.
   - Read the Y-axis scale carefully
   - Identify where a dashed vertical line, "3/4", "2/3", or "APEX" annotation indicates the EXPECTED RESOLUTION DATE
   - At that future date, interpolate both trendlines: read the upper trendline's Y value at the resolution date → type "resistance" (bullish break trigger); read the lower trendline's Y value at the resolution date → type "support" (bearish break trigger)
   - If a price is explicitly labeled near the resolution point (e.g., "5085" written at the apex or current price), use that as the "entry" level — it represents the current or apex price, NOT the breakout trigger
   - The "resistance" and "support" values must be the trendline values AT THE PROJECTED DATE, not today's trendline position
   - The projected date = the X-axis date at the dashed vertical / resolution marker → add to "projected_dates"
   - Example: triangle upper line descends from 5500 toward 5200 by April; lower line ascends from 4600 toward 4950 by April → resistance: 5200, support: 4950, projected_dates: ["2026-04-01"]

   For NEUTRAL / KEEP WATCH setups, classify levels as:
   - Current price or labeled apex price → type "entry"
   - Upper trendline value at projected resolution date → type "resistance" (close above = bullish confirmed)
   - Lower trendline value at projected resolution date → type "support" (close below = bearish confirmed)
   - Do NOT classify any level as "target" in a neutral setup unless it has an explicit price label far from current price
   - Do NOT force bullish or bearish — return "neutral" and let the user decide after seeing the breakout

6. PROJECTED DATES
   - Any dates visible near x-axis annotations, dashed vertical lines, "3/4", "2/3", or "APEX" markers

7. MULTI-PANEL CHARTS
   - If the image shows 2 or more chart panels side-by-side or stacked, analyze each independently
   - Set "panels" to an array with one entry per panel, each with its own ticker, price_levels, direction, confidence, and summary
   - The top-level ticker/price_levels/direction fields should reflect the most prominent / left-most panel
   - If the image has only one chart, set "panels" to null

DIRECTION SANITY CHECK:
After extracting all levels and determining direction, perform this self-check:
- If direction is "bullish" but ALL targets are significantly below the entry → reconsider, this may be bearish
- If direction is "bearish" but ALL targets are significantly above the entry → reconsider, this may be bullish
- A 20%+ mismatch between direction and target positions is almost certainly wrong

Return ONLY valid JSON — no markdown, no explanation, just the JSON object:
{
  "image_type": "stock_chart" | "annotated_chart" | "text_screenshot" | "other",
  "ticker": "string" | null,
  "y_axis_ticks": [number],
  "price_levels": [
    {
      "value": number,
      "type": "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown",
      "label": "string or null"
    }
  ],
  "annotations": ["string array — every text annotation found on the chart"],
  "timeframe": "string" | null,
  "direction": "bullish" | "bearish" | "neutral" | null,
  "projected_dates": ["ISO date string array"],
  "confidence": 0.0,
  "summary": "1-2 sentences describing what the chart shows and the trade setup",
  "panels": null | [
    {
      "ticker": "string" | null,
      "price_levels": [{ "value": number, "type": "target"|"support"|"resistance"|"entry"|"stop_loss"|"unknown", "label": "string"|null }],
      "direction": "bullish" | "bearish" | "neutral" | null,
      "confidence": 0.0,
      "summary": "string"
    }
  ]
}

If the image is not a trading chart (irrelevant image, meme, photograph, etc.), return:
{
  "image_type": "other",
  "ticker": null,
  "price_levels": [],
  "annotations": [],
  "timeframe": null,
  "direction": null,
  "projected_dates": [],
  "confidence": 0.0,
  "summary": "Not a trading chart"
}`;
}

/**
 * Returns the generic (non-Coach-specific) Vision prompt.
 * Used as fallback when the database is unavailable or the Coach Profile
 * has not been bootstrapped yet.
 */
export function getGenericVisionPrompt(): string {
  return `You are a trading chart analyst. Analyze this image from a day trading coach's post.

Identify and extract:
0. Y-AXIS SCALE (DO THIS FIRST): Read EVERY numeric label on the Y-axis. Record as ordered list bottom to top. Output in "y_axis_ticks" field. ALL price readings depend on this.
1. Ticker symbol (from chart header, watermark, or labels)
2. ALL price levels marked on the chart — use the Y-axis scale from step 0
   CRITICAL STEP: Read every tick label on the Y-axis to establish the price scale. Then for each drawn horizontal line or annotation:
   - If a price label is written directly on or next to the line, use that value
   - If a line has NO label, interpolate its exact price by matching its Y-position against the Y-axis scale — NEVER skip unlabeled lines
   - Include horizontal lines of any color, dashed or solid, prominent or subtle
   - GAP FILL TARGETS: If a visible gap exists between candles, the opposite edge is a likely target. Look for "gap fill" annotations or arrows pointing into gaps.
   - SUPPORT/RESISTANCE FLIP AT MOVING AVERAGES: When price crosses a key MA (50-day, 200-day), former support becomes resistance and vice versa.
3. Classify each level as: price target, support, resistance, entry/confirmation, or stop loss
4. Any text annotations the coach has added to the image
5. The timeframe of the chart (daily, 4H, 1H, weekly)
6. The trade direction — derive from level positions, NOT from the historical price trend:

   STEP-DOWN / DESCENDING STAIR-STEP — identify and classify BEFORE applying general rules:
   When the chart shows ALL of:
   (a) A diagonal trendline descending from upper-left to lower-right spanning the FULL chart width, AND
   (b) Two or more FLAT (horizontal) rectangular highlighted/shaded zones at progressively LOWER price levels, AND
   (c) Sharp nearly-vertical drops connecting the zones:
   → This is a STEP-DOWN continuation pattern. Classify direction = "bearish".
   → The diagonal line is a RESISTANCE CEILING — it is NOT a price target. Classify all points on the diagonal line as "resistance".
   → Do NOT classify the diagonal trendline's value as "target" even if that value is above current price.
   → EXTRACT EVERY ZONE BOUNDARY: For each flat consolidation box, read the Y-axis to determine the exact upper and lower price of that zone. Add BOTH boundaries as separate price_levels entries:
     - The upper boundary of each zone → type "resistance", label "Step N upper" (N = 1 for highest zone, 2 for next, etc.)
     - The lower boundary of each zone → type "support", label "Step N lower"
   → The lower boundary of the CURRENT (lowest/most recent) flat zone is the confirmation/breakdown level — also add it as type "entry".
   → EXTRACT DIAGONAL ENDPOINTS: Read the Y-axis price where the diagonal resistance line starts (left edge) and ends (right edge). Add both as type "resistance", labeled "Diagonal start" and "Diagonal end".
   → Target = below the current step's lower boundary. If no explicit target is labeled below, set no target.
   → A dashed vertical line at the right of the chart indicates the projected timing of the next breakdown, not a price level.

   - Targets ABOVE the confirmation/entry level → "bullish"
   - Targets BELOW the confirmation/entry level → "bearish"
   - A chart showing a prior decline with price now at the bottom and targets above = BULLISH setup
   - SUPPORT BREAKDOWN: When an annotation explicitly labels a price as "CRITICAL SUPPORT", "KEY SUPPORT", or "SUPPORT" and current price is AT or BELOW that level, this is a BEARISH setup — classify the labeled level as "resistance" (broken support now acts as resistance), set direction = "bearish"
   - Two opposite arrows, symmetrical triangle at apex, or explicit both-way scenarios → "neutral" (Keep Watch)
   CONVERGING TRENDLINES (triangles, wedges): when two trendlines converge toward an apex, the breakout price is TIME-DEPENDENT.
   - Find the expected resolution date: look for a dashed vertical line, "3/4", "2/3", or "APEX" marker on the X-axis
   - At that date, interpolate the upper trendline Y-value → type "resistance" (breakout above = bullish)
   - At that date, interpolate the lower trendline Y-value → type "support" (breakdown below = bearish)
   - Any labeled price at the current/apex point (e.g., "5085") → type "entry"
   - Add the resolution date to "projected_dates"
7. Any projected dates visible on the x-axis near annotations, dashed vertical lines, "3/4" or "APEX" markers

DIRECTION SANITY CHECK: If direction is "bullish" but ALL targets are below entry (or vice versa), reconsider — a 20%+ mismatch is almost certainly wrong.

Return ONLY valid JSON:
{
  "image_type": "stock_chart" | "annotated_chart" | "text_screenshot" | "other",
  "ticker": "string" | null,
  "y_axis_ticks": [number],
  "price_levels": [
    { "value": number, "type": "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown", "label": "string" | null }
  ],
  "annotations": ["string"],
  "timeframe": "string" | null,
  "direction": "bullish" | "bearish" | "neutral" | null,
  "projected_dates": ["ISO date string"],
  "confidence": 0.0 to 1.0,
  "summary": "Brief description of what the chart shows",
  "panels": null | [{ "ticker": "string"|null, "price_levels": [...], "direction": "bullish"|"bearish"|"neutral"|null, "confidence": number, "summary": "string" }]
}`;
}
