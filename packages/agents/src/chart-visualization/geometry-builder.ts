/**
 * Geometry Builder
 *
 * Maps the normalized Vision output (ChartGeometry) to real price coordinates
 * (ChartData) using the extracted trade levels and current price as anchors.
 *
 * This is pure math — no API calls, runs in <10ms.
 */

import type { ChartGeometry, ChartData, WyckoffKeyPoints, HeadAndShouldersKeyPoints, ChannelKeyPoints, DoubleTopBottomKeyPoints, BroadeningTopKeyPoints, StepDownKeyPoints, TriangleKeyPoints } from "./types";

interface TradeLevels {
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceConfirmation: number | null;
  stopLoss: number | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
}

/**
 * Build a renderable ChartData object from:
 * - geometry: shape data from Vision
 * - trade: price levels from the NLP/Parser Agent
 * - currentPrice: live price from the Price Monitor
 */
export function buildChartData(
  geometry: ChartGeometry,
  trade: TradeLevels,
  currentPrice: number
): ChartData {
  const {
    priceTargetLow,
    priceTargetHigh,
    priceConfirmation,
    stopLoss,
    supportLevel,
    resistanceLevel,
  } = trade;

  // ── Scale normalized shape to real prices ─────────────────────────────────
  // If the geometry pass captured the actual y-axis labels (yAxisMin/yAxisMax),
  // use those to scale priceShape — this preserves the chart's true price range.
  // Fall back to deriving the scale from known trade levels if not available.
  const chartYMin = geometry.yAxisMin;
  const chartYMax = geometry.yAxisMax;

  let scaleMin: number;
  let scaleMax: number;

  if (chartYMin !== null && chartYMax !== null && chartYMax > chartYMin) {
    // Use actual y-axis range from the chart image
    scaleMin = chartYMin;
    scaleMax = chartYMax;
  } else {
    // Derive from known levels as fallback (less accurate but workable)
    const knownLevels = [
      priceConfirmation,
      supportLevel,
      resistanceLevel,
      currentPrice,
    ].filter((v): v is number => v !== null && v !== undefined);
    const rawMin = knownLevels.length ? Math.min(...knownLevels) : currentPrice * 0.95;
    const rawMax = knownLevels.length ? Math.max(...knownLevels) : currentPrice * 1.05;
    const pad = (rawMax - rawMin) * 0.08;
    scaleMin = rawMin - pad;
    scaleMax = rawMax + pad;
  }

  const scaleRange = scaleMax - scaleMin;
  const scalePoint = (normalized: number): number =>
    scaleMin + normalized * scaleRange;

  // ── Y-axis viewport — always wide enough to show all levels including targets ──
  const allLevels = [
    priceTargetLow,
    priceTargetHigh,
    priceConfirmation,
    stopLoss,
    supportLevel,
    resistanceLevel,
    currentPrice,
    scaleMin,
    scaleMax,
  ].filter((v): v is number => v !== null && v !== undefined);

  const rawMin = Math.min(...allLevels);
  const rawMax = Math.max(...allLevels);
  const padding = (rawMax - rawMin) * 0.08;

  const yMin = Math.floor(rawMin - padding);
  const yMax = Math.ceil(rawMax + padding);

  const prices = geometry.priceShape.map(scalePoint);

  // ── Build projected path ───────────────────────────────────────────────────
  // Extend from the last real price point toward the target.
  // If projectedTimeframe is available, use 6-8 points; otherwise 4.
  const numProjected = geometry.projectedTimeframe ? 8 : 4;
  const lastReal = prices[prices.length - 1];
  const targetMid =
    priceTargetLow !== null && priceTargetHigh !== null
      ? (priceTargetLow + priceTargetHigh) / 2
      : priceTargetHigh ?? priceTargetLow ?? lastReal * 0.9;

  const projected: number[] = [];
  for (let i = 1; i <= numProjected; i++) {
    const t = i / numProjected;
    // Ease toward target with slight exponential curve
    const eased = t * t;
    projected.push(lastReal + (targetMid - lastReal) * eased);
  }

  // ── Time window ────────────────────────────────────────────────────────────
  const totalPoints = prices.length + projected.length;
  let timeWindow: ChartData["timeWindow"] = null;

  if (geometry.projectedTimeframe) {
    const startIdx = prices.length; // projected portion starts here
    const endIdx = totalPoints - 1;
    timeWindow = {
      startIdx,
      endIdx,
      label: "Target window",
      duration: geometry.projectedTimeframe.label,
    };
  }

  // ── Month labels ───────────────────────────────────────────────────────────
  const months = deriveMonths(geometry.dateRange, totalPoints);

  // ── Channel lines ──────────────────────────────────────────────────────────
  const channelUpper = geometry.channelUpper
    ? padToLength(geometry.channelUpper.map(scalePoint), totalPoints)
    : null;
  const channelLower = geometry.channelLower
    ? padToLength(geometry.channelLower.map(scalePoint), totalPoints)
    : null;

  // ── Pattern-specific key points ────────────────────────────────────────────
  let patternType: ChartData["patternType"] = null;
  let wyckoffKeyPoints: ChartData["wyckoffKeyPoints"] = null;
  let headAndShouldersKeyPoints: ChartData["headAndShouldersKeyPoints"] = null;
  let channelKeyPoints: ChartData["channelKeyPoints"] = null;
  let doubleTopBottomKeyPoints: ChartData["doubleTopBottomKeyPoints"] = null;
  let broadeningTopKeyPoints: ChartData["broadeningTopKeyPoints"] = null;
  let stepDownKeyPoints: ChartData["stepDownKeyPoints"] = null;
  let triangleKeyPoints: ChartData["triangleKeyPoints"] = null;

  if (geometry.pattern === "distribution") {
    patternType = "distribution";
    const bc = resistanceLevel ?? priceTargetHigh ?? currentPrice * 1.05;
    const ar = supportLevel ?? currentPrice * 0.95;
    wyckoffKeyPoints = {
      bc,
      ar,
      ut: resistanceLevel ? Math.round((resistanceLevel * 1.015) * 100) / 100 : null,
      lpsy: priceConfirmation,
      sow: priceTargetLow ?? null,
      currentPhase: currentPrice <= ar ? "breakdown" : "distribution",
    } satisfies WyckoffKeyPoints;
  }

  if (geometry.pattern === "double_top") {
    patternType = "double_top";
    // doubleLevel = the two equal peaks (resistance)
    // neckline = valley between the peaks (support that breaks)
    // target = priceTargetLow or measured move below neckline
    const doubleLevel = resistanceLevel ?? priceTargetHigh ?? currentPrice * 1.05;
    const amplitude   = doubleLevel * 0.12; // ~12% typical double-top depth
    const neckline    = supportLevel ?? priceConfirmation ?? (doubleLevel - amplitude);
    const amp         = doubleLevel - neckline;
    doubleTopBottomKeyPoints = {
      doubleLevel,
      neckline,
      target: priceTargetLow ?? Math.round((neckline - amp) * 100) / 100,
      currentPhase: currentPrice <= neckline ? "broken" : "forming",
    } satisfies DoubleTopBottomKeyPoints;
  }

  if (geometry.pattern === "double_bottom") {
    patternType = "double_bottom";
    // doubleLevel = the two equal troughs (support)
    // neckline = peak between the troughs (resistance to break above)
    // target = priceTargetHigh or measured move above neckline
    const doubleLevel = supportLevel ?? currentPrice * 0.92;
    const amplitude   = doubleLevel * 0.08;
    const neckline    = resistanceLevel ?? priceConfirmation ?? (doubleLevel + amplitude);
    const amp         = neckline - doubleLevel;
    doubleTopBottomKeyPoints = {
      doubleLevel,
      neckline,
      target: priceTargetHigh ?? Math.round((neckline + amp) * 100) / 100,
      currentPhase: currentPrice >= neckline ? "broken" : "forming",
    } satisfies DoubleTopBottomKeyPoints;
  }

  if (geometry.pattern === "ascending_channel") {
    patternType = "ascending_channel";
    // upper = resistance (top of channel), lower = confirmation (break level)
    // target = priceTargetLow (below channel after break)
    const upper = resistanceLevel ?? currentPrice * 1.04;
    const lower = priceConfirmation ?? supportLevel ?? currentPrice * 0.98;
    channelKeyPoints = {
      upper,
      lower,
      slope: "ascending",
      target: priceTargetLow ?? null,
      currentPhase: currentPrice <= lower ? "broken" : "intact",
    } satisfies ChannelKeyPoints;
  }

  if (geometry.pattern === "descending_channel") {
    patternType = "descending_channel";
    // upper = confirmation (break level above), lower = support (bottom of channel)
    // target = priceTargetHigh (above channel after bullish break)
    const upper = priceConfirmation ?? resistanceLevel ?? currentPrice * 1.02;
    const lower = supportLevel ?? currentPrice * 0.96;
    channelKeyPoints = {
      upper,
      lower,
      slope: "descending",
      target: priceTargetHigh ?? null,
      currentPhase: currentPrice >= upper ? "broken" : "intact",
    } satisfies ChannelKeyPoints;
  }

  if (geometry.pattern === "flag") {
    patternType = "flag";
    // A flag is a channel-shaped consolidation after a sharp move.
    // Bull flag (descending channel) → target above current price.
    // Bear flag (ascending channel)  → target below current price.
    const isBullFlag =
      (priceTargetHigh !== null && priceTargetHigh > currentPrice) ||
      (priceTargetLow === null && priceTargetHigh === null);
    if (isBullFlag) {
      // Descending consolidation: upper = resistance, lower = support/confirmation
      const upper = resistanceLevel ?? currentPrice * 1.03;
      const lower = priceConfirmation ?? supportLevel ?? currentPrice * 0.97;
      channelKeyPoints = {
        upper,
        lower,
        slope: "descending",
        target: priceTargetHigh ?? null,
        currentPhase: currentPrice >= upper ? "broken" : "intact",
      } satisfies ChannelKeyPoints;
    } else {
      // Ascending consolidation: upper = confirmation/resistance, lower = support
      const upper = priceConfirmation ?? resistanceLevel ?? currentPrice * 1.03;
      const lower = supportLevel ?? currentPrice * 0.97;
      channelKeyPoints = {
        upper,
        lower,
        slope: "ascending",
        target: priceTargetLow ?? null,
        currentPhase: currentPrice <= lower ? "broken" : "intact",
      } satisfies ChannelKeyPoints;
    }
  }

  if (geometry.pattern === "head_and_shoulders") {
    patternType = "head_and_shoulders";
    // headHigh = resistance level (the top of the head)
    // neckline = confirmation level (Coach's "confirm short below" = neckline break)
    // target = priceTargetLow or the measured move (2 × neckline − head)
    const headHigh  = resistanceLevel ?? priceTargetHigh ?? currentPrice * 1.08;
    const neckline  = priceConfirmation ?? supportLevel ?? currentPrice * 0.97;
    const amplitude = headHigh - neckline;
    // Shoulders typically peak ~30–40% below the head-to-neckline amplitude
    const shoulderH = neckline + amplitude * 0.65;
    headAndShouldersKeyPoints = {
      headHigh,
      leftShoulderHigh:  shoulderH,
      rightShoulderHigh: shoulderH * 0.98, // right shoulder slightly lower
      neckline,
      target: priceTargetLow ?? Math.round((neckline - amplitude) * 100) / 100,
      // backtest = price has broken the neckline but is now back above it (retesting from below)
      currentPhase:
        currentPrice > neckline && currentPrice <= neckline * 1.03
          ? "backtest"
          : currentPrice <= neckline
          ? "breakdown"
          : "forming",
    } satisfies HeadAndShouldersKeyPoints;
  }

  if (geometry.pattern === "step_down") {
    patternType = "step_down";

    const sd = geometry.stepDownData;
    const hasYAxis = geometry.yAxisMin != null && geometry.yAxisMax != null;

    // Detect whether stepDownData values are normalized (0–1) or already in
    // absolute dollar prices. The shape extractor prompt now requests dollar
    // prices, but older snapshots may still have normalized values.
    const isNormalized = sd
      ? [sd.diagonalStart, sd.diagonalEnd, ...sd.zones.flatMap((z) => [z.upper, z.lower])]
          .every((v) => v >= 0 && v <= 1.0)
      : false;

    // Helper: convert normalized 0–1 value to real price, or pass through if already dollar
    const toPrice = (v: number): number =>
      isNormalized && hasYAxis ? geometry.yAxisMin! + v * (geometry.yAxisMax! - geometry.yAxisMin!) : v;

    if (sd && sd.zones.length >= 2 && (hasYAxis || !isNormalized)) {
      // ── Use Vision-extracted geometry directly ──
      const diagStart = toPrice(sd.diagonalStart);
      const diagEnd = toPrice(sd.diagonalEnd);

      const steps = sd.zones.map((z, i) => ({
        upper: toPrice(z.upper),
        lower: toPrice(z.lower),
        phase: (i === sd.zones.length - 1
          ? (currentPrice <= toPrice(z.lower) ? "broken" as const : "active" as const)
          : "broken" as const),
      }));

      const activeStep = steps[steps.length - 1];
      const stepHeight = activeStep.upper - activeStep.lower;

      stepDownKeyPoints = {
        resistanceStart: diagStart,
        resistanceEnd: diagEnd,
        steps,
        target: priceTargetLow ?? Math.round((activeStep.lower - stepHeight) * 100) / 100,
        currentPhase: currentPrice <= activeStep.lower ? "breaking_down" : "consolidating",
      } satisfies StepDownKeyPoints;
    } else {
      // ── Fallback: estimate from trade levels (legacy behavior) ──
      const step2Lower = priceConfirmation ?? supportLevel ?? currentPrice * 0.93;
      const step2Upper = resistanceLevel ?? currentPrice * 1.06;
      const stepHeight = Math.max(step2Upper - step2Lower, step2Upper * 0.04);
      const step1Lower = step2Upper + stepHeight * 0.25;
      const step1Upper = step1Lower + stepHeight;
      const diagStart = step1Upper * 1.18;
      const diagEnd   = step2Lower * 0.82;
      stepDownKeyPoints = {
        resistanceStart: diagStart,
        resistanceEnd:   diagEnd,
        steps: [
          { upper: step1Upper, lower: step1Lower, phase: "broken" },
          { upper: step2Upper, lower: step2Lower, phase: currentPrice <= step2Lower ? "broken" : "active" },
        ],
        target: priceTargetLow ?? Math.round((step2Lower - stepHeight) * 100) / 100,
        currentPhase: currentPrice <= step2Lower ? "breaking_down" : "consolidating",
      } satisfies StepDownKeyPoints;
    }
  }

  if (geometry.pattern === "broadening_top") {
    patternType = "broadening_top";
    // upperEnd = 5th peak (distribution zone) — resistanceLevel is the most direct signal
    // lowerEnd = 4th trough (break-below level) — supportLevel or priceConfirmation
    const upperEnd = resistanceLevel ?? priceTargetHigh ?? currentPrice * 1.05;
    const lowerEnd = supportLevel ?? priceConfirmation ?? currentPrice * 0.85;
    broadeningTopKeyPoints = {
      upperEnd,
      lowerEnd,
      target: priceTargetLow ?? null,
      currentPhase: currentPrice <= lowerEnd ? "breakdown" : "forming",
    } satisfies BroadeningTopKeyPoints;
  }

  if (geometry.pattern === "triangle") {
    patternType = "triangle";
    const td = geometry.triangleData;

    if (td && td.swingPoints.length >= 4) {
      // Use Vision-extracted geometry directly (dollar prices)
      const expectedBreakout: "up" | "down" | null =
        td.subtype === "ascending" ? "up"
        : td.subtype === "descending" ? "down"
        : null;

      // Measured move = height of triangle base projected from apex
      const baseHeight = td.upperTrendline.startPrice - td.lowerTrendline.startPrice;
      const target = expectedBreakout === "up"
        ? (priceTargetHigh ?? Math.round((td.apexPrice + baseHeight) * 100) / 100)
        : expectedBreakout === "down"
        ? (priceTargetLow ?? Math.round((td.apexPrice - baseHeight) * 100) / 100)
        : priceTargetHigh ?? priceTargetLow ?? null;

      const currentPhase: "forming" | "broken_up" | "broken_down" =
        currentPrice > td.upperTrendline.endPrice * 1.005 ? "broken_up"
        : currentPrice < td.lowerTrendline.endPrice * 0.995 ? "broken_down"
        : "forming";

      triangleKeyPoints = {
        subtype: td.subtype,
        upperStart: td.upperTrendline.startPrice,
        upperEnd: td.upperTrendline.endPrice,
        lowerStart: td.lowerTrendline.startPrice,
        lowerEnd: td.lowerTrendline.endPrice,
        swingPoints: td.swingPoints.map((sp) => ({
          x: sp.xFraction,
          price: sp.price,
          type: sp.type,
        })),
        apexPrice: td.apexPrice,
        apexX: td.apexXFraction,
        target,
        expectedBreakout,
        currentPhase,
      } satisfies TriangleKeyPoints;
    } else {
      // Fallback: estimate from trade levels
      const upper = resistanceLevel ?? currentPrice * 1.04;
      const lower = supportLevel ?? priceConfirmation ?? currentPrice * 0.96;
      const mid = (upper + lower) / 2;
      triangleKeyPoints = {
        subtype: "symmetrical",
        upperStart: upper * 1.03,
        upperEnd: upper,
        lowerStart: lower * 0.97,
        lowerEnd: lower,
        swingPoints: [],
        apexPrice: mid,
        apexX: 0.80,
        target: priceTargetHigh ?? priceTargetLow ?? null,
        expectedBreakout: null,
        currentPhase: currentPrice > upper ? "broken_up"
          : currentPrice < lower ? "broken_down" : "forming",
      } satisfies TriangleKeyPoints;
    }
  }

  return {
    prices,
    projected,
    yMin,
    yMax,
    targetLow: priceTargetLow,
    targetHigh: priceTargetHigh,
    confirmation: priceConfirmation,
    stopLoss: stopLoss,
    months,
    timeWindow,
    channelUpper,
    channelLower,
    patternType,
    wyckoffKeyPoints,
    headAndShouldersKeyPoints,
    channelKeyPoints,
    doubleTopBottomKeyPoints,
    broadeningTopKeyPoints,
    stepDownKeyPoints,
    triangleKeyPoints,
  };
}

/**
 * Regenerate ChartData after a parsed trade correction.
 * The price shape from geometry is unchanged — only the coordinate mapping
 * updates based on the corrected trade levels.
 */
export function rebuildChartData(
  storedGeometry: ChartGeometry,
  correctedTrade: TradeLevels,
  currentPrice: number
): ChartData {
  return buildChartData(storedGeometry, correctedTrade, currentPrice);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function deriveMonths(
  dateRange: ChartGeometry["dateRange"],
  totalPoints: number
): string[] {
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const labelCount = Math.min(6, totalPoints);

  if (!dateRange) {
    // Fallback: last N months ending today
    const now = new Date();
    const labels: string[] = [];
    for (let i = labelCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(MONTH_NAMES[d.getMonth()]);
    }
    return labels;
  }

  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const spanMs = end.getTime() - start.getTime();
  const spanDays = spanMs / (1000 * 60 * 60 * 24);

  // For spans ≤ 30 days (intraday / multi-day charts), use "Mon DD" labels
  // so a 45-min chart spanning Mar 8–15 shows "Mar 8", "Mar 10" etc. instead of all "Mar".
  if (spanDays <= 30) {
    const labels: string[] = [];
    for (let i = 0; i < labelCount; i++) {
      const t = labelCount <= 1 ? 0 : i / (labelCount - 1);
      const d = new Date(start.getTime() + spanMs * t);
      labels.push(`${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`);
    }
    return labels;
  }

  const labels: string[] = [];
  for (let i = 0; i < labelCount; i++) {
    const t = i / (labelCount - 1);
    const d = new Date(start.getTime() + spanMs * t);
    labels.push(MONTH_NAMES[d.getMonth()]);
  }

  return labels;
}

/** Extend or trim an array to a target length by repeating the last value. */
function padToLength(arr: number[], targetLength: number): number[] {
  if (arr.length >= targetLength) return arr.slice(0, targetLength);
  const last = arr[arr.length - 1];
  return [...arr, ...Array(targetLength - arr.length).fill(last)];
}
