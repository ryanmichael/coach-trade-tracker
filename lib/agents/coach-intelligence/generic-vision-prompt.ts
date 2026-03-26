/**
 * Generic Vision Prompt — standalone module with NO database dependencies.
 *
 * Used by the test harness and as a fallback when Coach Profile is unavailable.
 * The full Coach-specific prompt lives in vision-prompt.ts (requires Prisma).
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
