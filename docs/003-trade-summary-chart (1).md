# Component Handoff: Trade Summary Chart

## Status: Ready for Build
## Priority: P1
## Design System Version: 1.2.0
## Prototype Reference: `coachtrack_chart_with_time_overlay` (Claude Chat visualization)
## Depends On: 002-quick-paste-panel (analysis service, Vision pipeline)

---

## Description

Replaces the gray "Technical chart from X post" placeholder in the Primary Post Card with a generated SVG line chart that visualizes Coach's trade thesis. The chart is not a reproduction of Coach's screenshot — it's a **simplified, branded summary** rendered from structured data extracted by the Chart Visualization Agent.

Every chart follows the same visual language regardless of what Coach's original screenshot looked like (TradingView, ThinkorSwim, annotated screenshots). This gives Coachtrack a consistent, premium feel.

---

## File Structure

### New Components
- `apps/web/components/charts/TradeSummaryChart.tsx` — the SVG chart component
- `apps/web/components/charts/ChartLevelLine.tsx` — reusable horizontal level (target, confirmation, stop)
- `apps/web/components/charts/TimeWindowOverlay.tsx` — vertical time band with label
- `apps/web/components/charts/PriceLine.tsx` — price curve + area fill + projected dashed extension
- `apps/web/components/charts/PriceDot.tsx` — current price indicator with badge

### New Agent Module
- `packages/agents/src/chart-visualization/index.ts` — agent entry point
- `packages/agents/src/chart-visualization/shape-extractor.ts` — Vision prompt + response parser
- `packages/agents/src/chart-visualization/geometry-builder.ts` — maps normalized shapes to real coordinates
- `packages/agents/src/chart-visualization/types.ts` — ChartGeometry, ChartData interfaces

### Modified
- `apps/web/components/right-panel/PrimaryPostCard.tsx` — replace `.chart-placeholder` div with `<TradeSummaryChart>`
- `packages/agents/src/analysis-service.ts` — expand `AnalysisResult` with `chartGeometry` field
- Prisma schema: add `chartData Json?` field to `CoachPost` model

---

## Chart Spec

### Anatomy

```
┌──────────────────────────────────────────────────────┐
│  AAPL  $174.50                            Bullish    │  ← Header (from PrimaryPostCard, not chart)
│                                                      │
│  Target $185–190 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  ← Green dashed lines
│  ┌─────────────┐  ░░░░░░░░░░░░░░░░ target ░░░░░░    │  ← Green fill (only in time window)
│  │Target window│  ░░░░░░░░░░░░░░░░ zone   ░░░░░░    │  ← Indigo time band
│  └─────────────┘         ╱ ╱ ╱ projected              │  ← Dashed projected line
│                        ╱                              │
│  Confirmation $172 ─ ─●─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  ← Amber dashed line
│                      [$175]  ← current price dot     │
│               ╱╲    ╱                                 │
│         ╱╲  ╱  ╲  ╱   ← price line (solid indigo)   │
│       ╱    ╲    ╲╱                                    │
│  ───╱────────────────── area fill (indigo gradient)  │
│                                                      │
│  Stop $165 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← Red dashed line
│                                                      │
│  $160 ──────────────────────────────────────── $195  │  ← Y-axis (DM Mono)
│  Jan         Feb         Mar         Apr             │  ← X-axis
│                          ~3–4 weeks                  │  ← Duration annotation
├──────────────────────────────────────────────────────┤
│  ● Price  ╌ Projected  ● Target  ● Confirmation  ● Stop │  ← Legend
└──────────────────────────────────────────────────────┘
```

### Rendering Rules

- **SVG only** — no canvas, no charting library. Pure `<svg>` with `<path>`, `<line>`, `<rect>`, `<text>`, `<circle>`.
- **All colors via design system tokens** — use CSS custom properties. Chart is dark-mode native.
- **Responsive** — `viewBox="0 0 540 260"`, `width: 100%`, no fixed pixel width.
- **Padding:** top: 20, right: 60 (Y-axis labels), bottom: 30 (X-axis), left: 50.

### Visual Layers (render order, back to front)

1. **Y-axis grid lines** — `rgba(255,255,255,0.04)`, 0.5px, 5–6 steps
2. **Time window band** — `--accent-primary` at 4% opacity, full chart height, soft dashed vertical edges at 20% opacity
3. **Target zone fill** — `--semantic-positive` at 7% opacity. Constrained to time window if present, otherwise full width.
4. **Level lines** — horizontal dashed lines:
   - Target: `--semantic-positive`, 0.5px, dash `4,4`, 40% opacity
   - Confirmation: `--semantic-warning`, 0.75px, dash `6,3`, 50% opacity
   - Stop loss: `--semantic-negative`, 0.75px, dash `3,3`, 45% opacity
5. **Price area fill** — linear gradient from `--accent-primary` 12% → 0% opacity
6. **Price line** — `--accent-primary`, 1.5px, round joins/caps
7. **Projected line** — `--accent-primary`, 1px, dash `4,4`, 35% opacity
8. **Current price dot** — 3.5px circle, `--accent-primary` fill, 2px `--bg-surface` stroke
9. **Current price badge** — rounded rect with DM Mono price label
10. **Level labels** — 9px, weight 500, uppercase, 0.04em tracking, same color as their line
11. **Time window label** — "Target window" pill at top of band, accent-muted fill
12. **Time window duration** — 9px, tertiary, centered below the band
13. **Axis labels** — Y: DM Mono 10px, tertiary. X: DM Sans 10px, tertiary.

### Legend

Rendered below the SVG in HTML (not inside SVG). Small colored dots + labels.

```
● Price  ╌ Projected  ● Target zone  ● Confirmation  ● Stop
```

---

## Data Interface

### ChartData (stored on CoachPost.chartData)

```typescript
interface ChartData {
  // Price curve — 15–25 points representing simplified price action
  prices: number[];

  // Projected path — 4–8 points extending toward target
  projected: number[];

  // Y-axis bounds
  yMin: number;
  yMax: number;

  // Horizontal levels
  targetLow: number | null;
  targetHigh: number | null;
  confirmation: number | null;
  stopLoss: number | null;

  // X-axis
  months: string[];              // e.g. ["Jan", "Feb", "Mar", "Apr"]

  // Time horizon overlay
  timeWindow: {
    startIdx: number;            // index into full points array (prices + projected)
    endIdx: number;
    label: string;               // "Target window"
    duration: string;            // "~3–4 weeks", "Q2 2026", etc.
  } | null;

  // Optional: channel lines
  channelUpper: number[] | null;
  channelLower: number[] | null;
}
```

### How ChartData is Produced

1. **Vision extracts `ChartGeometry`** — the Chart Visualization Agent's expanded Vision prompt returns normalized shapes
2. **`geometry-builder.ts` maps to `ChartData`** — scales normalized values to real price coordinates using extracted levels
3. **Stored on `CoachPost.chartData`** — JSON field, generated once during ingestion, re-generated if user corrects parsed values via Report

---

## Component Props

```typescript
interface TradeSummaryChartProps {
  data: ChartData;
  direction: 'long' | 'short';
  ticker: string;
  currentPrice: number;
}
```

The header (ticker, price, direction badge) is rendered by `PrimaryPostCard`, not by the chart component. The chart only renders the SVG + legend.

---

## Integration Point

In `PrimaryPostCard.tsx`, replace:

```tsx
<div className="chart-placeholder">
  <svg>...</svg>
  <span>Technical chart from X post</span>
</div>
```

With:

```tsx
{post.chartData ? (
  <TradeSummaryChart
    data={post.chartData}
    direction={post.direction}
    ticker={post.ticker}
    currentPrice={ticker.currentPrice}
  />
) : (
  <div className="chart-placeholder">...</div>  // fallback for posts without chart data
)}
```

---

## Testing Checklist

- [ ] Chart renders from structured data with no external dependencies
- [ ] All colors use CSS custom properties (grep for hardcoded hex in component)
- [ ] Target zone constrained to time window when present
- [ ] Time window label + duration render correctly
- [ ] Bullish chart: confirmation line below price, target above
- [ ] Bearish chart: confirmation line above price, target below
- [ ] Projected dashed line connects smoothly from last real price point
- [ ] Current price dot + badge positioned at last real price point
- [ ] Legend renders below SVG in HTML
- [ ] Chart is responsive — scales with container width
- [ ] Falls back to placeholder when chartData is null
- [ ] Chart regenerates when user submits Report feedback that changes parsed values


---
---


# PRD Addition: Chart Visualization Agent (§5.12)

## Status: New — add to PRD v1.3
## Agent Number: 5.12 (after §5.11 Security/Auth Specialist)

---

### 5.12 Chart Visualization Agent

**Role:** Transforms Coach's chart screenshots into structured, renderable chart data. Sits in the analysis pipeline between the Vision pass and the frontend, producing the `ChartData` object that the `TradeSummaryChart` component renders as a branded SVG.

**Why a dedicated agent:** The existing NLP/Parser Agent (§5.3) extracts discrete values (ticker, price levels, dates). This agent extracts *geometry* — the shape of the price action, the visual pattern, the implied time horizon. It's a fundamentally different extraction task that requires a specialized Vision prompt and a mapping layer that the parser doesn't need.

**Responsibilities:**

#### 1. Shape Extraction (Vision)

Sends each chart screenshot to Claude Vision with a specialized prompt that asks for:

- **Price curve shape** — a normalized array of 15–25 Y-values (0.0–1.0) representing the simplified price trajectory. Not candlesticks, not exact OHLC — just the gestalt shape that a trader's eye follows. "Draw the line a human would draw to summarize this chart."
- **Channel boundaries** — if the chart shows an ascending/descending channel, broadening pattern, or wedge, extract upper and lower boundary arrays (same 0–1 normalization).
- **Pattern classification** — identify the dominant pattern: `ascending_channel`, `descending_channel`, `broadening_top`, `distribution`, `accumulation`, `head_and_shoulders`, `double_top`, `double_bottom`, `flag`, `triangle`, `range`.
- **Timeframe and date range** — read the X-axis to determine the chart's time span and granularity (daily, 4H, weekly).
- **Implied time horizon** — estimate when the price is likely to reach the target zone based on the projected trajectory and x-axis dates. Return as `earliest` and `latest` dates with a human-readable `label`.

**Vision Prompt (specialized for shape extraction):**

```
You are a chart geometry extractor for a trading dashboard. Analyze this chart image.

Your job is NOT to identify exact prices (another system does that).
Your job IS to extract the SHAPE and TRAJECTORY of the price action.

Return ONLY valid JSON:
{
  "priceShape": [0.0 to 1.0, ...],     // 15-25 points, 0=bottom of chart, 1=top
  "channelUpper": [0.0 to 1.0, ...] | null,   // upper channel boundary if visible
  "channelLower": [0.0 to 1.0, ...] | null,   // lower channel boundary if visible
  "pattern": "ascending_channel" | "distribution" | ... | null,
  "timeframe": "daily" | "4H" | "1H" | "weekly",
  "dateRange": { "start": "2026-01-15", "end": "2026-03-20" },
  "projectedTimeframe": {
    "earliest": "2026-03-10",
    "latest": "2026-04-05",
    "label": "~3-4 weeks"
  } | null,
  "confidence": 0.0 to 1.0
}

Rules:
- priceShape should capture the TREND, not every wiggle. Smooth it.
- 0.0 = lowest price visible on chart, 1.0 = highest price visible.
- If no clear channel or pattern, return null for those fields.
- projectedTimeframe = your best estimate of when price reaches the annotated target.
```

**Coach Intelligence Integration:** Before calling Vision, the agent receives the Coach Profile context (chart platform, annotation style, methodology) from the Coach Intelligence Agent (§5.4). This is injected into the Vision prompt so it knows to look for Wyckoff-specific patterns, Coach's annotation colors, and Coach's charting style.

#### 2. Geometry Building

Maps the normalized Vision output to real-world coordinates:

```typescript
function buildChartData(
  geometry: ChartGeometry,      // from Vision
  parsedTrade: ParsedTrade,     // from NLP/Parser Agent
  currentPrice: number          // from Price Monitor
): ChartData
```

**Mapping logic:**

- `prices[]` — scale `priceShape` from 0–1 to `yMin–yMax` (derived from the lowest and highest extracted levels ± 10% padding)
- `projected[]` — extend the price curve from the last real point toward the target price, following the trajectory implied by `priceShape`. If `projectedTimeframe` is set, the projected points should reach the target zone within that window.
- `yMin / yMax` — calculated from `min(stopLoss, support, targetLow) - 5%` to `max(targetHigh, resistance) + 5%`
- `months[]` — derived from `dateRange` in the geometry
- `timeWindow` — if `projectedTimeframe` exists, calculate `startIdx` and `endIdx` as positions in the combined `prices + projected` array corresponding to the earliest/latest dates
- `channelUpper / channelLower` — scale from 0–1 to yMin–yMax, extend to match total point count

#### 3. Chart Regeneration

When a user submits Report feedback (§6.9) that changes parsed values (e.g., correcting the price target from $190 to $195), the Chart Visualization Agent regenerates the `ChartData`:

1. Re-runs `buildChartData()` with the corrected `ParsedTrade` values
2. Updates the `CoachPost.chartData` JSON field
3. The frontend re-renders the chart with the corrected levels

The price shape itself doesn't change (it came from the image) — only the coordinate mapping and projected path update.

#### 4. Fallback Behavior

- **No chart image:** If the Coach post has no images or images classified as non-chart (meme, text screenshot), no `ChartData` is generated. The Primary Post Card falls back to the existing placeholder.
- **Low confidence shape:** If the Vision confidence for `priceShape` is below 0.5, generate a simplified "levels-only" chart with a flat line at the current price and the horizontal levels, but no price curve. Still useful.
- **Missing timeframe:** If `projectedTimeframe` is null, omit the time window overlay. The chart still renders price action + levels.

---

### Pipeline Integration

The Chart Visualization Agent runs **in parallel** with the existing NLP/Parser text pipeline, as part of the image analysis pass:

```
User pastes screenshot
        │
        ├──► Text regex pipeline (instant, <100ms)
        │
        └──► Image analysis (parallel):
                ├──► NLP/Parser Vision prompt → price levels, ticker, direction
                └──► Chart Viz Vision prompt  → price shape, pattern, timeframe
                        │
                        ▼
                   Merge results
                        │
                        ▼
                   buildChartData() → ChartData JSON
                        │
                        ▼
                   Store on CoachPost.chartData
```

**Performance:** The Chart Viz Vision call runs as a separate Claude API call in parallel with the NLP/Parser Vision call. Both hit the same image. Total time: ~2–3 seconds (same as before, since they're parallel). The `buildChartData()` mapping is pure math and runs in <10ms.

**Alternative (single call):** To reduce API cost, the shape extraction prompt could be merged into the existing NLP/Parser Vision prompt (§5.3). This is simpler but makes the prompt longer and the response harder to parse. Recommended: start with two parallel calls for clean separation, merge into one call in v2 if cost is a concern.

---

### Data Model Addition

Add to `CoachPost` model in Prisma schema:

```prisma
model CoachPost {
  // ... existing fields ...
  chartData       Json?           // ChartData object for TradeSummaryChart rendering
  chartConfidence Float?          // Vision confidence for shape extraction (0-1)
}
```

---

### API Route Addition

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/parse/chart-geometry` | Extract chart shape from image via Chart Viz Agent Vision prompt |
| `POST` | `/api/chart/rebuild` | Regenerate ChartData after parsed trade correction (called by feedback processor) |

---

### Sections Modified

- **§5.3 NLP/Parser Agent** — add note that chart shape extraction is handled by the Chart Visualization Agent (§5.12), not the parser. The parser still extracts price levels; the Chart Viz Agent extracts geometry.
- **§5.4 Coach Intelligence Agent** — add note that Coach Profile context (chart platform, annotation style) is also provided to the Chart Visualization Agent's Vision prompt.
- **§6.4 Right Panel — Ticker Detail View** — update Primary Post Card spec: replace "Chart image placeholder (180px height)" with "Trade Summary Chart (TradeSummaryChart component) rendered from chartData, falling back to placeholder when chartData is null."
- **§6.9 Report Feedback** — add step to feedback pipeline: "If corrected values affect chart levels, trigger Chart Visualization Agent to regenerate ChartData."
