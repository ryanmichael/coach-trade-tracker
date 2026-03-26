"use client";

/**
 * TradeSummaryChart
 *
 * SVG line chart that visualizes Coach's trade thesis — not a reproduction of
 * Coach's screenshot, but a branded summary rendered from structured ChartData.
 *
 * Replaces the chart placeholder in PrimaryPostCard.
 */

import type { ChartData } from "@repo/agents";
import type { OHLCBar } from "@/lib/polygon";
import { ChartLevelLine } from "./ChartLevelLine";
import { TimeWindowOverlay } from "./TimeWindowOverlay";
import { PriceLine } from "./PriceLine";
import { PriceDot } from "./PriceDot";

interface TradeSummaryChartProps {
  data: ChartData;
  direction: "long" | "short" | "watch";
  currentPrice: number;
  /** Real OHLC bars from Polygon. When provided, replaces the schematic chart. */
  priceHistory?: OHLCBar[];
}

// ── SVG coordinate system ────────────────────────────────────────────────────

const VIEW_W = 540;
const VIEW_H = 260;
const PAD = { top: 20, right: 60, bottom: 30, left: 50 };
const CHART_LEFT = PAD.left;
const CHART_RIGHT = VIEW_W - PAD.right;
const CHART_TOP = PAD.top;
const CHART_BOTTOM = VIEW_H - PAD.bottom;
const CHART_W = CHART_RIGHT - CHART_LEFT;
const CHART_H = CHART_BOTTOM - CHART_TOP;

const GRADIENT_ID = "priceAreaGradient";

// ── X-axis label generator ────────────────────────────────────────────────────
// Chooses the right format automatically based on total time span:
//   ≤ 90 days  → DD/MM  (e.g. "13/3")
//   ≤ 730 days → MMM    (e.g. "Mar")  — cross-year: "Mar '26"
//   > 730 days → 'YY    (e.g. "'25")

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function generateXLabels(
  startMs: number,
  endMs: number,
): { label: string; x: number }[] {
  const totalMs = endMs - startMs;
  const totalDays = totalMs / 86_400_000;
  const result: { label: string; x: number }[] = [];

  const frac = (ms: number) => CHART_LEFT + ((ms - startMs) / totalMs) * CHART_W;

  if (totalDays <= 90) {
    // Daily — one tick every ~10–14 days
    const intervalDays = Math.max(7, Math.ceil(totalDays / 7));
    const cursor = new Date(startMs);
    cursor.setDate(cursor.getDate() + intervalDays);
    while (cursor.getTime() <= endMs) {
      result.push({ label: `${cursor.getDate()}/${cursor.getMonth() + 1}`, x: frac(cursor.getTime()) });
      cursor.setDate(cursor.getDate() + intervalDays);
    }
  } else if (totalDays <= 730) {
    // Monthly — one tick per month boundary
    let prevYear = new Date(startMs).getFullYear();
    const cursor = new Date(startMs);
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() + 1); // first full month
    while (cursor.getTime() <= endMs) {
      const yr = cursor.getFullYear();
      const label = yr !== prevYear
        ? `${MN[cursor.getMonth()]} '${String(yr).slice(2)}`
        : MN[cursor.getMonth()];
      result.push({ label, x: frac(cursor.getTime()) });
      prevYear = yr;
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    // Yearly — one tick per year boundary
    const cursor = new Date(startMs);
    cursor.setMonth(0, 1);
    cursor.setFullYear(cursor.getFullYear() + 1); // first full year
    while (cursor.getTime() <= endMs) {
      result.push({ label: `'${String(cursor.getFullYear()).slice(2)}`, x: frac(cursor.getTime()) });
      cursor.setFullYear(cursor.getFullYear() + 1);
    }
  }

  return result;
}

function xAt(idx: number, totalPoints: number): number {
  if (totalPoints <= 1) return CHART_LEFT;
  return CHART_LEFT + (idx / (totalPoints - 1)) * CHART_W;
}

function yAt(price: number, yMin: number, yMax: number): number {
  if (yMax === yMin) return CHART_BOTTOM;
  return CHART_BOTTOM - ((price - yMin) / (yMax - yMin)) * CHART_H;
}

// ── Head & Shoulders chart ────────────────────────────────────────────────────
//
// Canonical template driven by HeadAndShouldersKeyPoints. Canonical path traces
// Left Shoulder → Head → Right Shoulder → neckline break → backtest → target.
// Neckline extends full width. Backtest bounce is explicitly labeled.

function HeadAndShouldersChart({
  data,
  currentPrice,
}: {
  data: ChartData;
  currentPrice: number;
}) {
  const kp = data.headAndShouldersKeyPoints;
  if (!kp) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
        Head & Shoulders — awaiting key price levels
      </div>
    );
  }

  const { headHigh, leftShoulderHigh, rightShoulderHigh, neckline, target, currentPhase } = kp;
  const amplitude = headHigh - neckline; // head-to-neckline distance (the measured move)
  const targetLevel = target ?? neckline - amplitude;

  // Y axis: headroom above head for labels, room below for target + projection
  const yMin = targetLevel - amplitude * 0.10;
  const yMax = headHigh    + amplitude * 0.20;

  // norm(n): price at n×amplitude above the neckline (0 = neckline, 1 = head)
  const norm = (n: number) => neckline + n * amplitude;

  const toY = (p: number) => yAt(p, yMin, yMax);
  const toX = (frac: number) => CHART_LEFT + frac * CHART_W;

  // ── Canonical path ────────────────────────────────────────────────────────
  // (X fraction 0–1, absolute price)
  // Key structural prices override their canonical positions.
  // Split at SOW_IDX: solid historical line, then dashed projected (incl. backtest).
  const lsFrac  = leftShoulderHigh  / headHigh; // normalize shoulder heights relative to head
  const rsFrac  = rightShoulderHigh / headHigh;

  const SOW_IDX = 20; // neckline break point
  const PATH: [number, number][] = [
    [0.00, norm(0.10)],                           // approach
    [0.04, norm(0.28)],
    [0.09, norm(0.48)],
    [0.13, norm(0.60)],
    [0.17, leftShoulderHigh],                     // ── Left Shoulder peak
    [0.21, norm(lsFrac * 0.72)],
    [0.25, norm(0.26)],
    [0.28, norm(0.04)],                           // left trough (at neckline)
    [0.32, norm(0.22)],
    [0.38, norm(0.58)],
    [0.43, norm(0.82)],
    [0.47, headHigh],                             // ── Head peak
    [0.51, norm(0.80)],
    [0.56, norm(0.44)],
    [0.59, norm(0.03)],                           // right trough (at neckline)
    [0.63, norm(0.20)],
    [0.67, rightShoulderHigh],                    // ── Right Shoulder peak
    [0.72, norm(rsFrac * 0.55)],
    [0.78, norm(0.14)],
    [0.84, norm(0.01)],                           // approaches neckline
    [0.88, norm(-0.06)],                          // ── SOW: breaks below neckline
    /* projected breakdown */
    [0.91, norm(-0.20)],                          // initial drop
    [0.93, norm(-0.08)],                          // backtest bounce
    [0.95, norm(0.02)],                           // ── Backtest peak (touches neckline from below)
    [0.97, norm(-0.14)],                          // neckline rejects
    [0.99, norm(-0.32)],
    [1.00, targetLevel],                          // target
  ];

  // Solid = 0 .. SOW_IDX (inclusive); Dashed = SOW_IDX .. end
  const BACKTEST_IDX = 23; // index of backtest peak in PATH
  const solidPts = PATH.slice(0, SOW_IDX + 1);
  const projPts  = PATH.slice(SOW_IDX);

  const pts = (arr: [number, number][]) =>
    arr.map(([x, p]) => `${toX(x)},${toY(p)}`).join(" ");

  const solidStr = pts(solidPts);
  const projStr  = pts(projPts);

  // Area polygon for historical portion
  const firstX = toX(PATH[0][0]);
  const lastSolidX = toX(PATH[SOW_IDX][0]);
  const areaStr = `${solidStr} ${lastSolidX},${CHART_BOTTOM} ${firstX},${CHART_BOTTOM}`;

  // ── Annotation anchors ──────────────────────────────────────────────────
  const lsX  = toX(0.17); const lsY_  = toY(leftShoulderHigh);
  const hdX  = toX(0.47); const hdY_  = toY(headHigh);
  const rsX  = toX(0.67); const rsY_  = toY(rightShoulderHigh);
  const sowX = toX(0.88); const sowY_ = toY(norm(-0.06));
  const btX  = toX(PATH[BACKTEST_IDX][0]);
  const btY_ = toY(PATH[BACKTEST_IDX][1]);

  // Neckline: horizontal at `neckline` price. Slightly upward slope (2% of amplitude)
  // across the chart approximates the real-world sloping neckline.
  const neckLeft  = CHART_LEFT;
  const neckRight = CHART_RIGHT;
  const neckY1 = toY(neckline - amplitude * 0.01); // left end slightly lower
  const neckY2 = toY(neckline + amplitude * 0.01); // right end slightly higher

  // Target dashed line
  const targetY_ = toY(targetLevel);

  // Current price dot — placed at the phase's natural position in the path
  const cpPrice = currentPrice > 0 ? currentPrice : rightShoulderHigh;
  const cpX = currentPhase === "backtest"   ? btX
             : currentPhase === "breakdown" ? toX(0.91)
             : rsX;
  const cpY_ = toY(cpPrice);

  // X-axis: SOW = "today" anchor
  const MS_PER_POINT = 10 * 86_400_000;
  const today = new Date();
  const chartStartMs = today.getTime() - SOW_IDX * MS_PER_POINT;
  const chartEndMs   = today.getTime() + (PATH.length - SOW_IDX) * MS_PER_POINT;
  const xLabels = generateXLabels(chartStartMs, chartEndMs);

  // Y-axis grid at key levels
  const gridLevels = [targetLevel, neckline, leftShoulderHigh, headHigh].filter(
    (v, _, arr) => arr.every((other) => other === v || Math.abs(toY(v) - toY(other)) >= 14)
  );

  const HS_GRAD = "hsAreaGrad";

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label="Head and Shoulders chart"
      >
        <defs>
          <linearGradient id={HS_GRAD} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent-primary)" stopOpacity={0.10} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Y-axis grid at key levels ── */}
        {gridLevels.map((p, i) => (
          <g key={i}>
            <line x1={CHART_LEFT} y1={toY(p)} x2={CHART_RIGHT} y2={toY(p)} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <text x={CHART_RIGHT + 6} y={toY(p) + 3.5} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start">
              {formatPrice(p, yMax)}
            </text>
          </g>
        ))}

        {/* ── Target dashed line ── */}
        {target !== null && (
          <line x1={CHART_LEFT} y1={targetY_} x2={CHART_RIGHT} y2={targetY_} stroke="var(--semantic-negative)" strokeWidth={0.5} strokeDasharray="3,4" opacity={0.30} />
        )}

        {/* ── Neckline (slightly sloping, solid) ── */}
        <line x1={neckLeft} y1={neckY1} x2={neckRight} y2={neckY2} stroke="var(--semantic-warning)" strokeWidth={1.25} opacity={0.65} />
        {/* Neckline label */}
        <text x={toX(0.44)} y={toY(neckline) - 6} style={{ fill: "var(--semantic-warning)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" fontStyle="italic" opacity={0.80}>
          Neckline
        </text>

        {/* ── Price area fill (historical) ── */}
        <polygon points={areaStr} fill={`url(#${HS_GRAD})`} />

        {/* ── Solid historical price line ── */}
        <polyline points={solidStr} stroke="var(--accent-primary)" strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* ── Dashed projected path (breakdown → backtest → target) ── */}
        <polyline points={projStr} stroke="var(--semantic-negative)" strokeWidth={1} fill="none" strokeDasharray="4,4" opacity={0.55} />

        {/* ── Backtest marker ── */}
        <circle cx={btX} cy={btY_} r={3.5} fill="var(--semantic-warning)" opacity={0.80} />
        <text x={btX + 8} y={btY_ - 5} style={{ fill: "var(--semantic-warning)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" fontStyle="italic" fontWeight={500} opacity={0.90}>
          Backtest
        </text>

        {/* ── Shoulder & Head labels ── */}
        <text x={lsX} y={lsY_ - 8} style={{ fill: "var(--text-secondary)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" opacity={0.80}>LS</text>
        <text x={hdX} y={hdY_ - 8} style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" fontWeight={500} opacity={0.90}>Head</text>
        <text x={rsX} y={rsY_ - 8} style={{ fill: "var(--text-secondary)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" opacity={0.80}>RS</text>

        {/* ── SOW label ── */}
        <text x={sowX} y={sowY_ + 16} style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" fontWeight={500} opacity={0.80}>SOW</text>

        {/* ── Right-side level labels ── */}
        <text x={CHART_RIGHT + 6} y={neckY2 + 3.5} style={{ fill: "var(--semantic-warning)" }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.75}>NL</text>
        {target !== null && (
          <text x={CHART_RIGHT + 6} y={targetY_ + 3.5} style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.65}>TGT</text>
        )}

        {/* ── Current price dot ── */}
        <PriceDot x={cpX} y={cpY_} price={cpPrice} />

        {/* ── X-axis labels ── */}
        <g>
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={VIEW_H - 4} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* ── Legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        {[
          { color: "var(--accent-primary)",    label: "Price",                                   dot: true,  dash: false },
          { color: "var(--semantic-negative)", label: "Breakdown",                                dot: false, dash: true  },
          { color: "var(--semantic-warning)",  label: `Neckline ${formatPrice(neckline, yMax)}`,  dot: false, dash: false },
          ...(target !== null ? [{ color: "var(--semantic-negative)", label: `Target ${formatPrice(targetLevel, yMax)}`, dot: false, dash: true }] : []),
          ...(currentPhase === "backtest" ? [{ color: "var(--semantic-warning)", label: "Backtest", dot: true, dash: false }] : []),
        ].map(({ color, label, dot, dash }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dot ? (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 14, height: 0, borderTop: `${dash ? "1px dashed" : "1.5px solid"} ${color}`, opacity: 0.7, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Double Top / Double Bottom chart ─────────────────────────────────────────
//
// Both directions share one component. Key visual differences:
//   Double Top:    horizontal dashed line at the RESISTANCE (doubleLevel),
//                  "DOUBLE TOP" label, solid red arrow projection downward.
//   Double Bottom: horizontal dashed line at the NECKLINE (between the troughs),
//                  "Double bottom" italic label at the troughs, dashed arrow up.

function DoublePatternChart({
  data,
  currentPrice,
}: {
  data: ChartData;
  currentPrice: number;
}) {
  const kp = data.doubleTopBottomKeyPoints;
  const isTop = data.patternType === "double_top";

  if (!kp) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
        {isTop ? "Double Top" : "Double Bottom"} — awaiting key price levels
      </div>
    );
  }

  const { doubleLevel, neckline, target, currentPhase } = kp;
  // amplitude: always positive — the vertical height of the pattern
  const amplitude = Math.abs(isTop ? doubleLevel - neckline : neckline - doubleLevel);
  const targetLevel = target ?? (isTop ? neckline - amplitude : neckline + amplitude);

  // norm → absolute price:
  //   top:    norm 0 = neckline (valley), norm 1 = doubleLevel (peaks)
  //   bottom: norm 0 = doubleLevel (troughs), norm 1 = neckline (peak between)
  const normToPrice = (n: number) =>
    isTop ? neckline + n * amplitude : doubleLevel + n * amplitude;
  const targetNorm = isTop
    ? (targetLevel - neckline) / amplitude      // negative (below neckline)
    : (targetLevel - doubleLevel) / amplitude;  // > 1 (above neckline)

  // Y axis
  const yMin = isTop  ? targetLevel - amplitude * 0.12 : doubleLevel - amplitude * 0.25;
  const yMax = isTop  ? doubleLevel + amplitude * 0.25 : targetLevel + amplitude * 0.12;
  const toY  = (p: number) => yAt(p, yMin, yMax);
  const toX  = (f: number) => CHART_LEFT + f * CHART_W;

  // ── Canonical path (normalised Y) ────────────────────────────────────────
  // SOW_IDX: where price crosses the key level (neckline for top, neckline for bottom)
  const SOW_IDX = 18;

  const TOP_NORMS: [number, number][] = [
    [0.00, 0.42], [0.04, 0.62], [0.09, 0.80], [0.13, 0.93],
    [0.17, 1.00], // first peak
    [0.21, 0.88], [0.25, 0.65], [0.30, 0.38], [0.35, 0.12],
    [0.39, 0.04], // valley
    [0.43, 0.18], [0.49, 0.48], [0.55, 0.72], [0.60, 0.90],
    [0.65, 1.00], // second peak
    [0.70, 0.88], [0.75, 0.65], [0.81, 0.35], [0.87, 0.02],
    [0.91, -0.08], // breaks below neckline ← SOW
    // projected
    [0.94, -0.38], [0.97, -0.68], [1.00, targetNorm],
  ];

  const BOT_NORMS: [number, number][] = [
    [0.00, 0.58], [0.04, 0.38], [0.09, 0.20], [0.13, 0.07],
    [0.17, 0.00], // first trough
    [0.21, 0.12], [0.25, 0.35], [0.30, 0.62], [0.35, 0.88],
    [0.39, 0.96], // neckline peak
    [0.43, 0.82], [0.49, 0.52], [0.55, 0.28], [0.60, 0.10],
    [0.65, 0.00], // second trough
    [0.70, 0.12], [0.75, 0.35], [0.81, 0.65], [0.87, 0.96],
    [0.91, 1.08], // breaks above neckline ← SOW
    // projected
    [0.94, 1.38], [0.97, 1.68], [1.00, targetNorm],
  ];

  const NORMS = isTop ? TOP_NORMS : BOT_NORMS;
  const solidNorms = NORMS.slice(0, SOW_IDX + 1);
  const projNorms  = NORMS.slice(SOW_IDX);

  const toCoord = ([xFrac, n]: [number, number]): [number, number] =>
    [toX(xFrac), toY(normToPrice(n))];

  const ptStr = (arr: [number, number][]) =>
    arr.map(toCoord).map(([x, y]) => `${x},${y}`).join(" ");

  const solidStr = ptStr(solidNorms);
  const projStr  = ptStr(projNorms);

  const [firstX]      = toCoord(NORMS[0]);
  const [lastSolidX]  = toCoord(NORMS[SOW_IDX]);
  const areaStr = `${solidStr} ${lastSolidX},${CHART_BOTTOM} ${firstX},${CHART_BOTTOM}`;

  // Annotation anchor points (first peak/trough, valley/neckline, second peak/trough)
  const [p1x, p1y] = toCoord(NORMS[4]);   // first peak or trough
  const [p2x, p2y] = toCoord(NORMS[14]);  // second peak or trough

  // Horizontal key line:
  //   Top    → at doubleLevel (the resistance), spanning between the two peaks
  //   Bottom → at neckline (the resistance between troughs)
  const linePrice = isTop ? doubleLevel : neckline;
  const lineY     = toY(linePrice);
  const lineLeft  = toX(0.10);
  const lineRight = toX(0.72);

  const targetY_ = toY(targetLevel);
  const projColor = isTop ? "var(--semantic-negative)" : "var(--semantic-positive)";
  // Double top: solid arrow (Coach's red arrow style). Double bottom: dashed.
  const projDash  = isTop ? undefined : "4,4";

  // Arrowhead at the end of projection
  const [ax, ay]   = toCoord(NORMS[NORMS.length - 1]);
  const [ax2, ay2] = toCoord(NORMS[NORMS.length - 2]);
  const angle      = Math.atan2(ay - ay2, ax - ax2);
  const asz        = 7;
  const arrowPts   = [
    [ax - asz * Math.cos(angle - 0.4), ay - asz * Math.sin(angle - 0.4)],
    [ax, ay],
    [ax - asz * Math.cos(angle + 0.4), ay - asz * Math.sin(angle + 0.4)],
  ].map(([x, y]) => `${x},${y}`).join(" ");

  // Current price dot
  const cp    = currentPrice > 0 ? currentPrice : linePrice;
  const cpX   = currentPhase === "broken" ? toX(0.95) : toX(0.75);
  const cpY_  = toY(cp);

  // X axis anchored to SOW = today
  const MS_PER_POINT = 10 * 86_400_000;
  const today        = new Date();
  const chartStartMs = today.getTime() - SOW_IDX * MS_PER_POINT;
  const chartEndMs   = today.getTime() + (NORMS.length - SOW_IDX) * MS_PER_POINT;
  const xLabels      = generateXLabels(chartStartMs, chartEndMs);

  // Y-axis grid
  const gridLevels = [doubleLevel, neckline, ...(target !== null ? [targetLevel] : [])].filter(
    (v, _, arr) => arr.every(other => other === v || Math.abs(toY(v) - toY(other)) >= 14)
  );

  const DTP_GRAD = "dtpGrad";

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label={isTop ? "Double Top chart" : "Double Bottom chart"}
      >
        <defs>
          <linearGradient id={DTP_GRAD} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent-primary)" stopOpacity={0.10} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Y-axis grid ── */}
        {gridLevels.map((p, i) => (
          <g key={i}>
            <line x1={CHART_LEFT} y1={toY(p)} x2={CHART_RIGHT} y2={toY(p)} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <text x={CHART_RIGHT + 6} y={toY(p) + 3.5} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start">
              {formatPrice(p, yMax)}
            </text>
          </g>
        ))}

        {/* ── Faint target line ── */}
        {target !== null && (
          <line x1={CHART_LEFT} y1={targetY_} x2={CHART_RIGHT} y2={targetY_} stroke={projColor} strokeWidth={0.5} strokeDasharray="3,5" opacity={0.25} />
        )}

        {/* ── Horizontal key line (resistance / neckline) ── */}
        <line x1={lineLeft} y1={lineY} x2={lineRight} y2={lineY} stroke="var(--text-secondary)" strokeWidth={1} strokeDasharray="5,3" opacity={0.65} />

        {/* ── Pattern label ── */}
        {isTop ? (
          // Double Top: label centered on the resistance line (like MAGS chart)
          <text
            x={(lineLeft + lineRight) / 2}
            y={lineY - 7}
            style={{ fill: "var(--accent-primary)" }}
            fontSize={9}
            fontFamily="'DM Sans', system-ui, sans-serif"
            textAnchor="middle"
            fontWeight={500}
            letterSpacing="0.05em"
            opacity={0.85}
          >
            DOUBLE TOP
          </text>
        ) : (
          // Double Bottom: italic label below the second trough (like SPX chart)
          <text
            x={p2x}
            y={p2y + 16}
            style={{ fill: "var(--text-secondary)" }}
            fontSize={9}
            fontFamily="'DM Sans', system-ui, sans-serif"
            textAnchor="middle"
            fontStyle="italic"
            opacity={0.80}
          >
            Double bottom
          </text>
        )}

        {/* ── Equal-level tick marks on both peaks / troughs ── */}
        <line x1={p1x - 6} y1={p1y} x2={p1x + 6} y2={p1y} stroke="var(--text-tertiary)" strokeWidth={0.75} opacity={0.50} />
        <line x1={p2x - 6} y1={p2y} x2={p2x + 6} y2={p2y} stroke="var(--text-tertiary)" strokeWidth={0.75} opacity={0.50} />

        {/* ── Price area fill ── */}
        <polygon points={areaStr} fill={`url(#${DTP_GRAD})`} />

        {/* ── Solid historical price line ── */}
        <polyline points={solidStr} stroke="var(--accent-primary)" strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* ── Projection path with arrowhead ── */}
        {currentPhase === "broken" && (
          <>
            <polyline
              points={projStr}
              stroke={projColor}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray={projDash}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.70}
            />
            {/* Arrowhead — two lines forming a V at the projection tip */}
            <polyline
              points={arrowPts}
              stroke={projColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.70}
            />
          </>
        )}

        {/* ── Current price dot ── */}
        <PriceDot x={cpX} y={cpY_} price={cp} />

        {/* ── X-axis labels ── */}
        <g>
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={VIEW_H - 4} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* ── Legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        {[
          { color: "var(--accent-primary)", label: "Price",                                                     dot: true,  dash: false },
          { color: "var(--text-secondary)", label: `${isTop ? "Resistance" : "Neckline"} ${formatPrice(linePrice, yMax)}`, dot: false, dash: true  },
          ...(target !== null ? [{ color: projColor, label: `Target ${formatPrice(targetLevel, yMax)}`, dot: false, dash: !isTop }] : []),
        ].map(({ color, label, dot, dash }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dot ? (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 14, height: 0, borderTop: `${dash ? "1px dashed" : "1.5px solid"} ${color}`, opacity: 0.7, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Channel chart (ascending + descending) ────────────────────────────────────
//
// One component covers both directions. The two parallel diagonal lines are the
// primary visual — price oscillates inside them with internal midline/quartile
// dashed subdivisions (matching Coach's TradingView annotation style).
// When broken: colored oval at breach point + "Major breach" / "Break" label +
// dashed curved projection toward the target.

function ChannelChart({
  data,
  currentPrice,
}: {
  data: ChartData;
  currentPrice: number;
}) {
  const kp = data.channelKeyPoints;
  if (!kp) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
        Channel — awaiting price levels
      </div>
    );
  }

  const { upper, lower, slope, target } = kp;
  const isAscending = slope === "ascending";
  const channelWidth = Math.max(upper - lower, 0.01);

  // Recompute currentPhase from live price — the stored phase was set at parse time
  // using a proxy price (e.g. target midpoint), not the actual current price.
  // Defaults to "intact" when no live price is available: "broken" must be confirmed
  // by real price data, never inferred from a proxy.
  const currentPhase: "broken" | "intact" =
    currentPrice > 0
      ? (isAscending ? currentPrice <= lower : currentPrice >= upper)
        ? "broken"
        : "intact"
      : "intact";

  // Visual slope: channel rises/falls by 2.2× its width across the full chart.
  // This gives a clear diagonal without being extreme.
  const slopeAmount = channelWidth * 2.2;

  // Channel bounds at any X fraction (0=left edge, 1=right edge = "now")
  const lowerAtX = (f: number) =>
    isAscending
      ? lower - slopeAmount * (1 - f)   // was lower in the past, is `lower` now
      : lower + slopeAmount * (1 - f);   // was higher in the past, is `lower` now
  const upperAtX = (f: number) => lowerAtX(f) + channelWidth;

  // Y axis: include all four channel corners + target
  const corners = [lowerAtX(0), upperAtX(0), lower, upper];
  const targetLevel = target;
  const allLevels = [...corners, ...(targetLevel !== null ? [targetLevel] : [])];
  const rawMin = Math.min(...allLevels);
  const rawMax = Math.max(...allLevels);
  const pad = channelWidth * 0.55;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const toY = (p: number) => yAt(p, yMin, yMax);
  const toX = (f: number) => CHART_LEFT + f * CHART_W;

  // ── Canonical oscillating path ───────────────────────────────────────────
  // Normalized Y: 0 = lower bound at that X, 1 = upper bound at that X.
  // Values < 0 or > 1 are outside the channel (post-break).
  // SOW_IDX: the point where price breaks out of the channel.
  const SOW_IDX = 19;

  const ASCEND_SOLID: [number, number][] = [
    [0.00, 0.45], [0.05, 0.74], [0.10, 0.92], [0.15, 0.60], [0.20, 0.20],
    [0.26, 0.54], [0.32, 0.88], [0.37, 0.58], [0.42, 0.22], [0.48, 0.60],
    [0.54, 0.90], [0.59, 0.60], [0.64, 0.24], [0.69, 0.55], [0.75, 0.85],
    [0.80, 0.55], [0.85, 0.24], [0.89, 0.08], [0.92, 0.02], [0.95, -0.10],
  ];
  const DESCEND_SOLID: [number, number][] = [
    [0.00, 0.55], [0.05, 0.26], [0.10, 0.08], [0.15, 0.40], [0.20, 0.80],
    [0.26, 0.46], [0.32, 0.12], [0.37, 0.42], [0.42, 0.78], [0.48, 0.40],
    [0.54, 0.10], [0.59, 0.40], [0.64, 0.76], [0.69, 0.45], [0.75, 0.15],
    [0.80, 0.45], [0.85, 0.76], [0.89, 0.92], [0.92, 0.98], [0.95, 1.10],
  ];

  // When intact: trim path at x≈0.80 (index 15) so it ends at the current price
  // dot and doesn't continue below the channel boundary. When broken: keep all
  // 20 points so the path visually shows the breakdown through the lower bound.
  const solidNormsAll = isAscending ? ASCEND_SOLID : DESCEND_SOLID;
  const solidNorms = currentPhase === "intact" ? solidNormsAll.slice(0, 16) : solidNormsAll;

  // Dynamic projection points from the break to the target
  const targetNormAtRight = targetLevel !== null
    ? (targetLevel - lower) / channelWidth         // normalized relative to right-edge lower
    : isAscending ? -1.5 : 2.5;

  const projNorms: [number, number][] = isAscending
    ? [
        [0.95, -0.10],
        [0.97, -0.55],  // sharp initial drop
        [0.99, -0.88],  // curves and decelerates
        [1.00, targetNormAtRight],
      ]
    : [
        [0.95, 1.10],
        [0.97, 1.50],   // sharp initial rise
        [0.99, 1.82],
        [1.00, targetNormAtRight],
      ];

  // Convert (xFrac, normY) → absolute price
  // normY is relative to the channel bounds at that x, hence the slope is baked in.
  const toAbsPrice = (xFrac: number, normY: number) =>
    lowerAtX(xFrac) + normY * channelWidth;

  const toCoord = ([x, n]: [number, number]): [number, number] =>
    [toX(x), toY(toAbsPrice(x, n))];

  const ptStr = (arr: [number, number][]) =>
    arr.map(toCoord).map(([x, y]) => `${x},${y}`).join(" ");

  const solidStr = ptStr(solidNorms);
  const projStr  = ptStr(projNorms);

  // Area fill polygon for the historical line
  const [firstX] = toCoord(solidNorms[0]);
  const [lastSolidX] = toCoord(solidNorms[solidNorms.length - 1]);
  const areaStr = `${solidStr} ${lastSolidX},${CHART_BOTTOM} ${firstX},${CHART_BOTTOM}`;

  // ── Channel corner coordinates ───────────────────────────────────────────
  const UL = [toX(0), toY(upperAtX(0))] as [number, number];
  const UR = [toX(1), toY(upper)]        as [number, number];
  const LL = [toX(0), toY(lowerAtX(0))] as [number, number];
  const LR = [toX(1), toY(lower)]        as [number, number];

  const channelFill = `${UL[0]},${UL[1]} ${UR[0]},${UR[1]} ${LR[0]},${LR[1]} ${LL[0]},${LL[1]}`;

  // Internal dashed lines at 25%, 50%, 75% of channel width (Coach's quartile lines)
  const internalFracs = [0.25, 0.50, 0.75];

  // Break oval + label anchor
  const [sowX, sowY_] = toCoord(solidNorms[solidNorms.length - 1]);
  const breakLabel  = isAscending ? "Major breach" : "Break";
  const ovalColor   = isAscending ? "var(--semantic-negative)" : "var(--semantic-positive)";

  // Target line
  const targetY_ = targetLevel !== null ? toY(targetLevel) : null;
  const targetColor = isAscending ? "var(--semantic-negative)" : "var(--semantic-positive)";

  // Current price dot
  const cp = currentPrice > 0 ? currentPrice : toAbsPrice(0.80, 0.50);
  const cpFrac = currentPhase === "broken" ? 0.97 : 0.80;
  const [cpX, cpY_] = currentPhase === "broken"
    ? [toX(cpFrac), toY(currentPrice > 0 ? currentPrice : toAbsPrice(cpFrac, isAscending ? -0.55 : 1.50))]
    : [toX(0.80), toY(cp)];

  // X-axis: SOW_IDX = "now"
  const MS_PER_POINT = 10 * 86_400_000;
  const today = new Date();
  const chartStartMs = today.getTime() - SOW_IDX * MS_PER_POINT;
  const chartEndMs   = today.getTime() + (projNorms.length - 1 + (solidNorms.length - SOW_IDX)) * MS_PER_POINT;
  const xLabels = generateXLabels(chartStartMs, chartEndMs);

  // Y-axis reference prices (right-edge channel bounds + target)
  const yLabelLevels = [lower, upper, ...(targetLevel !== null ? [targetLevel] : [])].filter(
    (v, _, arr) => arr.every(other => other === v || Math.abs(toY(v) - toY(other)) >= 14)
  );

  const CHAN_GRAD = `chanGrad`;

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label={`${isAscending ? "Ascending" : "Descending"} channel chart`}
      >
        <defs>
          <linearGradient id={CHAN_GRAD} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent-primary)" stopOpacity={0.09} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Y-axis grid at channel bounds + target ── */}
        {yLabelLevels.map((p, i) => (
          <g key={i}>
            <line x1={CHART_LEFT} y1={toY(p)} x2={CHART_RIGHT} y2={toY(p)} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <text x={CHART_RIGHT + 6} y={toY(p) + 3.5} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start">
              {formatPrice(p, yMax)}
            </text>
          </g>
        ))}

        {/* ── Target dashed horizontal line ── */}
        {targetY_ !== null && (
          <line x1={CHART_LEFT} y1={targetY_} x2={CHART_RIGHT} y2={targetY_} stroke={targetColor} strokeWidth={0.75} strokeDasharray="6,3" opacity={0.45} />
        )}

        {/* ── Channel fill (parallelogram) ── */}
        <polygon points={channelFill} fill="var(--accent-primary)" opacity={0.06} />

        {/* ── Channel boundary lines (solid gray, matching TradingView style) ── */}
        <line x1={UL[0]} y1={UL[1]} x2={UR[0]} y2={UR[1]} stroke="var(--text-secondary)" strokeWidth={1.25} opacity={0.45} />
        <line x1={LL[0]} y1={LL[1]} x2={LR[0]} y2={LR[1]} stroke="var(--text-secondary)" strokeWidth={1.25} opacity={0.45} />

        {/* ── Internal dashed lines (midline + quartiles, Coach's style) ── */}
        {internalFracs.map((frac, i) => (
          <line
            key={i}
            x1={toX(0)} y1={toY(lowerAtX(0) + frac * channelWidth)}
            x2={toX(1)} y2={toY(lowerAtX(1) + frac * channelWidth)}
            stroke="var(--accent-primary)"
            strokeWidth={0.5}
            strokeDasharray="5,5"
            opacity={i === 1 ? 0.30 : 0.18}  // midline slightly bolder
          />
        ))}

        {/* ── Price area fill ── */}
        <polygon points={areaStr} fill={`url(#${CHAN_GRAD})`} />

        {/* ── Solid historical price line ── */}
        <polyline points={solidStr} stroke="var(--accent-primary)" strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* ── Dashed projection path (post-break) ── */}
        {currentPhase === "broken" && (
          <polyline points={projStr} stroke={targetColor} strokeWidth={1} fill="none" strokeDasharray="4,4" opacity={0.55} />
        )}

        {/* ── Break oval ── */}
        {currentPhase === "broken" && (
          <ellipse cx={sowX} cy={sowY_} rx={22} ry={14} fill={ovalColor} opacity={0.14} stroke={ovalColor} strokeWidth={1.5} strokeOpacity={0.55} />
        )}

        {/* ── Break label ── */}
        {currentPhase === "broken" && (
          <text
            x={sowX + (isAscending ? 26 : 26)}
            y={sowY_ + (isAscending ? 4 : -8)}
            style={{ fill: ovalColor }}
            fontSize={9}
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontStyle="italic"
            fontWeight={500}
            opacity={0.90}
          >
            {breakLabel}
          </text>
        )}

        {/* ── Target label ── */}
        {targetY_ !== null && targetLevel !== null && (
          <text x={CHART_RIGHT + 6} y={targetY_ + 3.5} style={{ fill: targetColor }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.70}>
            {formatPrice(targetLevel, yMax)}
          </text>
        )}

        {/* ── Current price dot ── */}
        <PriceDot x={cpX} y={cpY_} price={currentPrice > 0 ? currentPrice : cp} />

        {/* ── X-axis labels ── */}
        <g>
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={VIEW_H - 4} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* ── Legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        {[
          { color: "var(--accent-primary)", label: "Price",                                         dot: true,  dash: false },
          { color: "var(--text-secondary)", label: `Channel ${formatPrice(lower, yMax)}–${formatPrice(upper, yMax)}`, dot: false, dash: false },
          ...(currentPhase === "broken" ? [{ color: ovalColor, label: breakLabel, dot: false, dash: true }] : []),
          ...(targetLevel !== null ? [{ color: targetColor, label: `Target ${formatPrice(targetLevel, yMax)}`, dot: false, dash: true }] : []),
        ].map(({ color, label, dot, dash }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dot ? (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 14, height: 0, borderTop: `${dash ? "1px dashed" : "1.5px solid"} ${color}`, opacity: 0.7, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Flag chart ───────────────────────────────────────────────────────────────
//
// Bull flag (descending channel) or bear flag (ascending channel).
// The flagpole stub at the left distinguishes this from the plain ChannelChart.
// - Bull flag: pole rises → price enters top of descending channel → consolidates → breaks up
// - Bear flag: pole drops → price enters bottom of ascending channel → consolidates → breaks down

function FlagChart({
  data,
  currentPrice,
}: {
  data: ChartData;
  currentPrice: number;
}) {
  const kp = data.channelKeyPoints;
  if (!kp) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
        Flag — awaiting price levels
      </div>
    );
  }

  const { upper, lower, slope, target } = kp;
  const isBullFlag   = slope === "descending"; // descending consolidation = bull flag
  const channelWidth = Math.max(upper - lower, 0.01);

  // Recompute currentPhase from live price (same proxy-price issue as ChannelChart)
  const currentPhase: "broken" | "intact" =
    currentPrice > 0
      ? (isBullFlag ? currentPrice >= upper : currentPrice <= lower)
        ? "broken"
        : "intact"
      : "intact";
  // Flag slope is shallower than a plain channel — it's a tight consolidation.
  const slopeAmount  = channelWidth * 1.2;

  // The flag channel occupies FLAG_START_F → FLAG_END_F.
  // The flagpole occupies x < FLAG_START_F.
  const FLAG_START_F = 0.20;
  const FLAG_END_F   = 0.88;
  const flagSpan     = FLAG_END_F - FLAG_START_F;

  // Channel bounds at any x fraction.
  // For x < FLAG_START_F the slope is clamped to FLAG_START_F (no slope in pole zone).
  const flagFracAtX = (f: number) =>
    Math.max(0, Math.min(1, (f - FLAG_START_F) / flagSpan));

  const lowerAtX = (f: number) =>
    isBullFlag
      ? lower + slopeAmount * (1 - flagFracAtX(f))  // descending: higher at left
      : lower - slopeAmount * (1 - flagFracAtX(f)); // ascending: lower at left

  const upperAtX = (f: number) => lowerAtX(f) + channelWidth;

  // Y axis: channel corners + target only.
  // The pole may render slightly outside the viewBox (overflow: visible handles this).
  const allLevels = [
    lower, upper,
    lowerAtX(FLAG_START_F), upperAtX(FLAG_START_F),
    ...(target !== null ? [target] : []),
  ];
  const rawMin = Math.min(...allLevels);
  const rawMax = Math.max(...allLevels);
  const pad    = channelWidth * 0.55;
  const yMin   = rawMin - pad;
  const yMax   = rawMax + pad;

  const toY = (p: number) => yAt(p, yMin, yMax);
  const toX = (f: number) => CHART_LEFT + f * CHART_W;

  // Convert (xFrac, normY) to absolute price.
  // normY is channel-relative: 0 = lower bound at x, 1 = upper bound.
  const toAbsPrice = (xFrac: number, normY: number) =>
    lowerAtX(xFrac) + normY * channelWidth;

  const toCoord = ([x, n]: [number, number]): [number, number] =>
    [toX(x), toY(toAbsPrice(x, n))];

  const ptStr = (arr: [number, number][]) =>
    arr.map(toCoord).map(([x, y]) => `${x},${y}`).join(" ");

  // ── Canonical paths ────────────────────────────────────────────────────────
  // normY > 1.0 = above upper channel at that x; < 0.0 = below lower channel.
  // Pole norms are outside the channel, entering it at FLAG_START_F.

  const targetNormAtRight = target !== null
    ? (target - lower) / channelWidth
    : isBullFlag ? 2.5 : -1.5;

  // Bull flag: pole rises from below-channel → enters top of descending channel → oscillates
  // down → breaks above upper → projects up toward target.
  const BULL_SOLID: [number, number][] = [
    [0.00, -0.5], [0.06, 0.1], [0.12, 0.6],  // pole (below channel → rising)
    [0.20,  1.0],                              // enters channel at upper bound
    [0.24, 0.55], [0.29, 0.14], [0.34, 0.46], [0.39, 0.80],
    [0.44, 0.48], [0.49, 0.14], [0.54, 0.46], [0.59, 0.80],
    [0.63, 0.50], [0.68, 0.14], [0.73, 0.46], [0.78, 0.80],
    [0.82, 0.52], [0.86, 0.14],
    [0.88, 0.26], [0.90, 1.12],               // breaks above upper channel
  ];
  const BULL_PROJ: [number, number][] = [
    [0.93, 1.52], [0.97, 1.88], [1.00, Math.max(targetNormAtRight, 1.9)],
  ];

  // Bear flag: pole drops from above-channel → enters bottom of ascending channel → oscillates
  // up → breaks below lower → projects down toward target.
  const BEAR_SOLID: [number, number][] = [
    [0.00, 2.5], [0.06, 1.9], [0.12, 1.3],   // pole (above channel → falling)
    [0.20, 0.0],                               // enters channel at lower bound
    [0.24, 0.45], [0.29, 0.86], [0.34, 0.54], [0.39, 0.18],
    [0.44, 0.52], [0.49, 0.86], [0.54, 0.54], [0.59, 0.18],
    [0.63, 0.50], [0.68, 0.86], [0.73, 0.54], [0.78, 0.18],
    [0.82, 0.48], [0.86, 0.84],
    [0.88, 0.72], [0.90, -0.12],              // breaks below lower channel
  ];
  const BEAR_PROJ: [number, number][] = [
    [0.93, -0.52], [0.97, -0.88], [1.00, Math.min(targetNormAtRight, -0.9)],
  ];

  const solidNorms = isBullFlag ? BULL_SOLID : BEAR_SOLID;
  const projNorms  = isBullFlag ? BULL_PROJ  : BEAR_PROJ;

  const solidStr = ptStr(solidNorms);
  const projStr  = ptStr(projNorms);

  const [firstX] = toCoord(solidNorms[0]);
  const [lastSolidX] = toCoord(solidNorms[solidNorms.length - 1]);
  const areaStr = `${solidStr} ${lastSolidX},${CHART_BOTTOM} ${firstX},${CHART_BOTTOM}`;

  // ── Channel corners (flag body only, not pole zone) ────────────────────────
  const UL = [toX(FLAG_START_F), toY(upperAtX(FLAG_START_F))] as [number, number];
  const UR = [toX(FLAG_END_F),   toY(upper)]                   as [number, number];
  const LL = [toX(FLAG_START_F), toY(lowerAtX(FLAG_START_F))] as [number, number];
  const LR = [toX(FLAG_END_F),   toY(lower)]                   as [number, number];
  const channelFill = `${UL[0]},${UL[1]} ${UR[0]},${UR[1]} ${LR[0]},${LR[1]} ${LL[0]},${LL[1]}`;

  // Internal quartile lines (flag body only)
  const internalFracs = [0.25, 0.50, 0.75];

  // Break oval
  const breakNorm = solidNorms[solidNorms.length - 1];
  const [breakX, breakY] = toCoord(breakNorm);
  const breakLabel  = isBullFlag ? "Break" : "Major breach";
  const accentColor = isBullFlag ? "var(--semantic-positive)" : "var(--semantic-negative)";

  // Projection arrowhead
  const [ax, ay]   = toCoord(projNorms[projNorms.length - 1]);
  const [ax2, ay2] = toCoord(projNorms[projNorms.length - 2]);
  const asz = 7;
  const ang = Math.atan2(ay - ay2, ax - ax2);
  const arrowPts = [
    [ax - asz * Math.cos(ang - 0.4), ay - asz * Math.sin(ang - 0.4)],
    [ax, ay],
    [ax - asz * Math.cos(ang + 0.4), ay - asz * Math.sin(ang + 0.4)],
  ].map(([x, y]) => `${x},${y}`).join(" ");

  // Target line
  const targetY_ = target !== null ? toY(target) : null;

  // Current price dot
  const BREAK_IDX = 19;
  const cpFrac = currentPhase === "broken" ? 0.93 : 0.78;
  const cpNorm = currentPhase === "broken" ? (isBullFlag ? 1.52 : -0.52) : 0.45;
  const cpX_ = toX(cpFrac);
  const cpY_ = toY(currentPrice > 0 ? currentPrice : toAbsPrice(cpFrac, cpNorm));

  // X-axis time anchoring: BREAK_IDX point = "now" (or recent break)
  const MS_PER_POINT = 10 * 86_400_000;
  const today = new Date();
  const chartStartMs = today.getTime() - BREAK_IDX * MS_PER_POINT;
  const totalPts = solidNorms.length + projNorms.length;
  const chartEndMs = today.getTime() + (totalPts - BREAK_IDX - 1) * MS_PER_POINT;
  const xLabels = generateXLabels(chartStartMs, chartEndMs);

  // Y-axis right-edge labels
  const yLabelLevels = [lower, upper, ...(target !== null ? [target] : [])].filter(
    (v, _, arr) => arr.every(other => other === v || Math.abs(toY(v) - toY(other)) >= 14)
  );

  const FLAG_GRAD = "flagGrad";

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label={`${isBullFlag ? "Bull" : "Bear"} flag chart`}
      >
        <defs>
          <linearGradient id={FLAG_GRAD} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent-primary)" stopOpacity={0.09} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Y-axis grid ── */}
        {yLabelLevels.map((p, i) => (
          <g key={i}>
            <line x1={CHART_LEFT} y1={toY(p)} x2={CHART_RIGHT} y2={toY(p)}
              stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <text x={CHART_RIGHT + 6} y={toY(p) + 3.5}
              style={{ fill: "var(--text-tertiary)" }}
              fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start">
              {formatPrice(p, yMax)}
            </text>
          </g>
        ))}

        {/* ── Target dashed horizontal line ── */}
        {targetY_ !== null && (
          <line x1={CHART_LEFT} y1={targetY_} x2={CHART_RIGHT} y2={targetY_}
            stroke={accentColor} strokeWidth={0.75} strokeDasharray="6,3" opacity={0.45} />
        )}

        {/* ── Pole-to-flag divider (subtle vertical dashed) ── */}
        <line
          x1={toX(FLAG_START_F)} y1={CHART_TOP}
          x2={toX(FLAG_START_F)} y2={CHART_BOTTOM}
          stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="3,4"
        />

        {/* ── Channel fill (flag body only) ── */}
        <polygon points={channelFill} fill="var(--accent-primary)" opacity={0.06} />

        {/* ── Channel boundary lines (flag body only) ── */}
        <line x1={UL[0]} y1={UL[1]} x2={UR[0]} y2={UR[1]}
          stroke="var(--text-secondary)" strokeWidth={1.25} opacity={0.45} />
        <line x1={LL[0]} y1={LL[1]} x2={LR[0]} y2={LR[1]}
          stroke="var(--text-secondary)" strokeWidth={1.25} opacity={0.45} />

        {/* ── Internal dashed quartile lines (flag body only) ── */}
        {internalFracs.map((frac, i) => (
          <line
            key={i}
            x1={toX(FLAG_START_F)} y1={toY(lowerAtX(FLAG_START_F) + frac * channelWidth)}
            x2={toX(FLAG_END_F)}   y2={toY(lowerAtX(FLAG_END_F)   + frac * channelWidth)}
            stroke="var(--accent-primary)"
            strokeWidth={0.5}
            strokeDasharray="5,5"
            opacity={i === 1 ? 0.30 : 0.18}
          />
        ))}

        {/* ── Price area fill ── */}
        <polygon points={areaStr} fill={`url(#${FLAG_GRAD})`} />

        {/* ── Solid price line (pole + flag body + break point) ── */}
        <polyline
          points={solidStr}
          stroke="var(--accent-primary)"
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* ── Dashed projection ── */}
        {currentPhase === "broken" && (
          <polyline points={projStr}
            stroke={accentColor} strokeWidth={1} fill="none"
            strokeDasharray="4,4" opacity={0.55} />
        )}

        {/* ── Projection arrowhead ── */}
        {currentPhase === "broken" && (
          <polyline points={arrowPts}
            stroke={accentColor} strokeWidth={1.5} fill="none"
            strokeLinecap="round" opacity={0.70} />
        )}

        {/* ── Break oval ── */}
        {currentPhase === "broken" && (
          <ellipse
            cx={breakX} cy={breakY} rx={22} ry={14}
            fill={accentColor} opacity={0.14}
            stroke={accentColor} strokeWidth={1.5} strokeOpacity={0.55}
          />
        )}

        {/* ── Break label ── */}
        {currentPhase === "broken" && (
          <text
            x={breakX + 26}
            y={breakY + (isBullFlag ? -8 : 4)}
            style={{ fill: accentColor }}
            fontSize={9}
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontStyle="italic"
            fontWeight={500}
            opacity={0.90}
          >
            {breakLabel}
          </text>
        )}

        {/* ── "Bull/Bear flag" watermark inside channel body ── */}
        <text
          x={toX(0.53)}
          y={toY(toAbsPrice(0.53, 0.50)) + 4}
          style={{ fill: "var(--text-tertiary)" }}
          fontSize={10}
          fontFamily="'DM Sans', system-ui, sans-serif"
          fontStyle="italic"
          textAnchor="middle"
          opacity={0.40}
        >
          {isBullFlag ? "Bull flag" : "Bear flag"}
        </text>

        {/* ── Target right-axis label ── */}
        {targetY_ !== null && target !== null && (
          <text x={CHART_RIGHT + 6} y={targetY_ + 3.5}
            style={{ fill: accentColor }}
            fontSize={9} fontFamily="'DM Mono', monospace"
            textAnchor="start" opacity={0.70}>
            {formatPrice(target, yMax)}
          </text>
        )}

        {/* ── Current price dot ── */}
        <PriceDot x={cpX_} y={cpY_} price={currentPrice > 0 ? currentPrice : toAbsPrice(cpFrac, cpNorm)} />

        {/* ── X-axis labels ── */}
        <g>
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={VIEW_H - 4}
              style={{ fill: "var(--text-tertiary)" }}
              fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif"
              textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* ── Legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        {[
          { color: "var(--accent-primary)", label: "Price",                                                dot: true,  dash: false },
          { color: "var(--text-secondary)", label: `Flag ${formatPrice(lower, yMax)}–${formatPrice(upper, yMax)}`, dot: false, dash: false },
          ...(currentPhase === "broken" ? [{ color: accentColor, label: breakLabel,                        dot: false, dash: true  }] : []),
          ...(target !== null            ? [{ color: accentColor, label: `Target ${formatPrice(target, yMax)}`, dot: false, dash: true  }] : []),
        ].map(({ color, label, dot, dash }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dot ? (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 14, height: 0, borderTop: `${dash ? "1px dashed" : "1.5px solid"} ${color}`, opacity: 0.7, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Broadening Top chart ──────────────────────────────────────────────────────
//
// Megaphone / broadening top template.
// Upper trendline ascends (connecting peaks 1→3→5); lower trendline descends
// (connecting troughs 2→4), creating a widening megaphone shape.
// Five numbered swing points oscillate between the diverging trendlines.
// Current state: distribution zone at the 5th peak, then breakdown toward target.

function BroadeningTopChart({
  data,
  currentPrice,
}: {
  data: ChartData;
  currentPrice: number;
}) {
  const kp = data.broadeningTopKeyPoints;
  if (!kp) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
        Broadening top — awaiting price levels
      </div>
    );
  }

  const { upperEnd, lowerEnd, target, currentPhase } = kp;
  const patternRange = Math.max(upperEnd - lowerEnd, 0.01);

  // Derive trendline start anchors synthetically from available data.
  // First peak (P1) was ~50% of the range below the 5th peak.
  // First trough (P2) was ~25% of the range above the 4th trough.
  const upperStart = upperEnd - patternRange * 0.50;
  const lowerStart = lowerEnd + patternRange * 0.25;

  // Canonical x-fractions for the 5 numbered swing points.
  const UPPER_X1 = 0.20; // Point 1 — first peak  (upper trendline left anchor)
  const LOWER_X1 = 0.32; // Point 2 — first trough (lower trendline left anchor)
  const UPPER_X2 = 0.78; // Point 5 — fifth peak   (upper trendline right anchor)
  const LOWER_X2 = 0.62; // Point 4 — fourth trough (lower trendline right anchor)

  // Trendline prices at any x fraction (linear, extended beyond anchors).
  const upperAtX = (f: number) =>
    upperStart + (upperEnd - upperStart) * (f - UPPER_X1) / (UPPER_X2 - UPPER_X1);
  const lowerAtX = (f: number) =>
    lowerStart + (lowerEnd - lowerStart) * (f - LOWER_X1) / (LOWER_X2 - LOWER_X1);

  // Prices at each numbered swing point.
  const P1 = upperStart;
  const P2 = lowerStart;
  const P3 = upperAtX(0.48);
  const P4 = lowerEnd;
  const P5 = upperEnd;

  // Target (cap so chart isn't excessively tall if target is very far below)
  const targetLevel = target !== null
    ? Math.max(target, lowerEnd - patternRange * 0.80)
    : lowerEnd - patternRange * 0.38;

  // Y axis: all swing points + target
  const allLevels = [P1, P2, P3, P4, P5, targetLevel];
  const rawMin = Math.min(...allLevels);
  const rawMax = Math.max(...allLevels);
  const pad    = patternRange * 0.10;
  const yMin   = rawMin - pad;
  const yMax   = rawMax + pad;

  const toY = (p: number) => yAt(p, yMin, yMax);
  const toX = (f: number) => CHART_LEFT + f * CHART_W;

  // ── Canonical price path (absolute prices) ────────────────────────────────
  const MID_12 = (P1 + P2) / 2;
  const MID_23 = (P2 + P3) / 2;
  const MID_34 = (P3 + P4) / 2;
  const MID_45 = (P4 + P5) / 2;

  const solidPts: [number, number][] = [
    // Pre-pattern approach
    [0.00, P1 * 0.74],
    [0.06, P1 * 0.79],
    [0.11, P1 * 0.87],
    [0.16, P1 * 0.94],
    // Point 1 — first peak
    [UPPER_X1, P1],
    // Descent to Point 2
    [0.25, MID_12 + patternRange * 0.05],
    [0.28, MID_12 - patternRange * 0.05],
    // Point 2 — first trough
    [LOWER_X1, P2],
    // Ascent to Point 3
    [0.38, MID_23 - patternRange * 0.08],
    [0.44, MID_23 + patternRange * 0.08],
    // Point 3 — second peak
    [0.48, P3],
    // Descent to Point 4
    [0.53, MID_34 + patternRange * 0.08],
    [0.58, MID_34 - patternRange * 0.05],
    // Point 4 — second trough
    [LOWER_X2, P4],
    // Ascent to Point 5 (distribution)
    [0.68, MID_45 - patternRange * 0.08],
    [0.73, MID_45 + patternRange * 0.10],
    // Point 5 — distribution zone oscillation
    [UPPER_X2, P5],
    [0.80, P5 * 0.990],
    [0.82, P5 * 1.005],  // slight upthrust (matching distribution phase)
    [0.84, P5 * 0.980],
    // Breakdown begins
    [0.88, P4 + (P5 - P4) * 0.55],
    [0.91, P4 + (P5 - P4) * 0.20],
    [0.93, lowerAtX(0.93) - patternRange * 0.04], // breaks below lower trendline
  ];

  const projPts: [number, number][] = [
    [0.96, lowerAtX(0.96) - patternRange * 0.18],
    [0.98, lowerAtX(0.98) - patternRange * 0.35],
    [1.00, targetLevel],
  ];

  const solidStr = solidPts.map(([x, p]) => `${toX(x)},${toY(p)}`).join(" ");
  const projStr  = projPts.map(([x, p]) => `${toX(x)},${toY(p)}`).join(" ");

  // ── Trendlines (capped to avoid going far outside chart area) ────────────
  const TREND_END_F = 0.88; // don't extend trendlines past the breakdown start
  const UL1 = [toX(UPPER_X1), toY(P1)]                  as [number, number];
  const UL2 = [toX(TREND_END_F), toY(upperAtX(TREND_END_F))] as [number, number];
  const LL1 = [toX(LOWER_X1), toY(P2)]                  as [number, number];
  const LL2 = [toX(TREND_END_F), toY(Math.max(lowerAtX(TREND_END_F), yMin + pad))] as [number, number];

  // ── Megaphone fill (trapezoid between the two trendlines) ─────────────────
  const megaFill = `${UL1[0]},${UL1[1]} ${UL2[0]},${UL2[1]} ${LL2[0]},${LL2[1]} ${LL1[0]},${LL1[1]}`;

  // ── Swing point label positions ──────────────────────────────────────────
  type SwingLabel = { x: number; y: number; label: string; above: boolean };
  const swingLabels: SwingLabel[] = [
    { x: toX(UPPER_X1), y: toY(P1), label: "1", above: true  },
    { x: toX(LOWER_X1), y: toY(P2), label: "2", above: false },
    { x: toX(0.48),     y: toY(P3), label: "3", above: true  },
    { x: toX(LOWER_X2), y: toY(P4), label: "4", above: false },
    { x: toX(UPPER_X2), y: toY(P5), label: "5", above: true  },
  ];

  // ── Distribution zone box (dashed rectangle near Point 5) ────────────────
  const distX1 = toX(0.75);
  const distX2 = toX(0.87);
  const distY1 = toY(P5 * 1.018);
  const distY2 = toY(P5 * 0.978);

  // ── Projection arrowhead ─────────────────────────────────────────────────
  const [ax, ay]   = [toX(projPts[projPts.length - 1][0]), toY(projPts[projPts.length - 1][1])];
  const [ax2, ay2] = [toX(projPts[projPts.length - 2][0]), toY(projPts[projPts.length - 2][1])];
  const asz = 7;
  const ang = Math.atan2(ay - ay2, ax - ax2);
  const arrowPts = [
    [ax - asz * Math.cos(ang - 0.4), ay - asz * Math.sin(ang - 0.4)],
    [ax, ay],
    [ax - asz * Math.cos(ang + 0.4), ay - asz * Math.sin(ang + 0.4)],
  ].map(([x, y]) => `${x},${y}`).join(" ");

  // ── Y-axis labels ─────────────────────────────────────────────────────────
  const yLabelLevels = [P4, P5, targetLevel].filter(
    (v, _, arr) => arr.every(other => other === v || Math.abs(toY(v) - toY(other)) >= 14)
  );

  // ── X-axis time anchoring (P5 = now, total span ~3 years) ────────────────
  const TOTAL_SPAN_MS = 1100 * 86_400_000;
  const today = new Date();
  const chartStartMs = today.getTime() - UPPER_X2 * TOTAL_SPAN_MS;
  const chartEndMs   = today.getTime() + (1.0 - UPPER_X2) * TOTAL_SPAN_MS;
  const xLabels = generateXLabels(chartStartMs, chartEndMs);

  // ── Current price dot ─────────────────────────────────────────────────────
  const cpX_ = currentPhase === "breakdown" ? toX(0.93) : toX(UPPER_X2);
  const cpY_ = currentPhase === "breakdown"
    ? toY(lowerAtX(0.93) - patternRange * 0.04)
    : toY(currentPrice > 0 ? currentPrice : P5);

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label="Broadening top chart"
      >
        {/* ── Y-axis grid ── */}
        {yLabelLevels.map((p, i) => (
          <g key={i}>
            <line x1={CHART_LEFT} y1={toY(p)} x2={CHART_RIGHT} y2={toY(p)}
              stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <text x={CHART_RIGHT + 6} y={toY(p) + 3.5}
              style={{ fill: "var(--text-tertiary)" }}
              fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start">
              {formatPrice(p, yMax)}
            </text>
          </g>
        ))}

        {/* ── Target dashed horizontal line ── */}
        {target !== null && (
          <line x1={CHART_LEFT} y1={toY(targetLevel)} x2={CHART_RIGHT} y2={toY(targetLevel)}
            stroke="var(--semantic-negative)" strokeWidth={0.75} strokeDasharray="6,3" opacity={0.40} />
        )}

        {/* ── Megaphone fill ── */}
        <polygon points={megaFill} fill="var(--accent-primary)" opacity={0.04} />

        {/* ── Upper trendline (ascending) ── */}
        <line
          x1={UL1[0]} y1={UL1[1]} x2={UL2[0]} y2={UL2[1]}
          stroke="var(--accent-primary)" strokeWidth={1.5} opacity={0.60}
        />

        {/* ── Lower trendline (descending) ── */}
        <line
          x1={LL1[0]} y1={LL1[1]} x2={LL2[0]} y2={LL2[1]}
          stroke="var(--accent-primary)" strokeWidth={1.5} opacity={0.60}
        />

        {/* ── Price area fill ── */}
        <polygon
          points={`${solidStr} ${toX(solidPts[solidPts.length - 1][0])},${CHART_BOTTOM} ${toX(solidPts[0][0])},${CHART_BOTTOM}`}
          fill="var(--accent-primary)" opacity={0.04}
        />

        {/* ── Solid price line ── */}
        <polyline
          points={solidStr}
          stroke="var(--accent-primary)"
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* ── Dashed projection ── */}
        {currentPhase === "breakdown" && (
          <polyline points={projStr}
            stroke="var(--semantic-negative)" strokeWidth={1} fill="none"
            strokeDasharray="4,4" opacity={0.55} />
        )}

        {/* ── Projection arrowhead ── */}
        {currentPhase === "breakdown" && (
          <polyline points={arrowPts}
            stroke="var(--semantic-negative)" strokeWidth={1.5} fill="none"
            strokeLinecap="round" opacity={0.70} />
        )}

        {/* ── Distribution zone box (dashed rectangle at Point 5) ── */}
        <rect
          x={distX1} y={distY1}
          width={distX2 - distX1} height={distY2 - distY1}
          fill="var(--accent-primary)" fillOpacity={0.07}
          stroke="var(--accent-primary)" strokeWidth={1} strokeDasharray="4,3" strokeOpacity={0.55}
          rx={2}
        />
        <text
          x={(distX1 + distX2) / 2}
          y={distY1 - 5}
          style={{ fill: "var(--accent-primary)" }}
          fontSize={8} fontFamily="'DM Sans', system-ui, sans-serif"
          fontWeight={500} textAnchor="middle" opacity={0.75}
        >
          Distribution
        </text>

        {/* ── Swing point labels (1–5) ── */}
        {swingLabels.map(({ x, y, label, above }) => (
          <g key={label}>
            <circle cx={x} cy={y} r={3.5}
              fill="var(--bg-surface)"
              stroke="var(--accent-primary)" strokeWidth={1.2}
              opacity={0.70}
            />
            <text
              x={x}
              y={above ? y - 8 : y + 14}
              style={{ fill: "var(--accent-primary)" }}
              fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif"
              fontWeight={500} textAnchor="middle" opacity={0.80}
            >
              {label}
            </text>
          </g>
        ))}

        {/* ── "Broadening top" italic watermark inside pattern body ── */}
        <text
          x={toX(0.46)}
          y={toY((P3 + P4) / 2) + 4}
          style={{ fill: "var(--accent-primary)" }}
          fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif"
          fontStyle="italic" fontWeight={500} textAnchor="middle" opacity={0.35}
        >
          Broadening top
        </text>

        {/* ── Target label (above dashed line, right of chart) ── */}
        {target !== null && (
          <text
            x={CHART_RIGHT + 6} y={toY(targetLevel) + 3.5}
            style={{ fill: "var(--semantic-negative)" }}
            fontSize={9} fontFamily="'DM Mono', monospace"
            textAnchor="start" opacity={0.70}
          >
            {formatPrice(targetLevel, yMax)}
          </text>
        )}

        {/* ── Current price dot ── */}
        <PriceDot x={cpX_} y={cpY_} price={currentPrice > 0 ? currentPrice : P5} />

        {/* ── X-axis labels ── */}
        <g>
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={VIEW_H - 4}
              style={{ fill: "var(--text-tertiary)" }}
              fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif"
              textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* ── Legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        {[
          { color: "var(--accent-primary)",    label: "Price",                                                   dot: true,  dash: false },
          { color: "var(--accent-primary)",    label: "Trendlines",                                              dot: false, dash: false },
          ...(currentPhase === "breakdown" ? [{ color: "var(--semantic-negative)", label: "Breakdown",           dot: false, dash: true  }] : []),
          ...(target !== null              ? [{ color: "var(--semantic-negative)", label: `Target ${formatPrice(targetLevel, yMax)}`, dot: false, dash: true }] : []),
        ].map(({ color, label, dot, dash }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dot ? (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 14, height: 0, borderTop: `${dash ? "1px dashed" : "1.5px solid"} ${color}`, opacity: 0.7, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wyckoff Distribution chart ───────────────────────────────────────────────
//
// Canonical template driven by WyckoffKeyPoints. Price path traces the
// distribution phases (PSY → BC → AR → UT → LPSY → SOW) then dashes into
// the projected breakdown. The trading range box anchors the BC/AR band.

function WyckoffDistributionChart({
  data,
  currentPrice,
}: {
  data: ChartData;
  currentPrice: number;
}) {
  const kp = data.wyckoffKeyPoints;
  if (!kp) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
        Wyckoff Distribution — awaiting key price levels
      </div>
    );
  }

  const { bc, ar, ut, lpsy, sow, currentPhase } = kp;
  const rangeH = Math.max(bc - ar, 0.01);

  // Derived levels when optional fields are absent
  const utLevel   = ut   ?? Math.round((bc + rangeH * 0.04) * 100) / 100;
  const lpsyLevel = lpsy ?? ar + rangeH * 0.40;
  const sowTarget = sow  ?? ar - rangeH * 0.35;
  const projEnd   = sowTarget - rangeH * 0.08;

  // Y axis: room above for UT label, room below for breakdown projection
  const yMin = projEnd  - rangeH * 0.06;
  const yMax = utLevel  + rangeH * 0.18;
  const toY = (p: number) => yAt(p, yMin, yMax);

  // norm(n) → price = ar + n * rangeH  (0 = AR level, 1 = BC level)
  const norm = (n: number) => ar + n * rangeH;

  // ── Canonical path ──────────────────────────────────────────────────────
  // (X fraction 0–1, absolute price)
  // Split at SOW_IDX: 0..SOW_IDX = solid historical line,
  //                   SOW_IDX..end = dashed projected breakdown
  const SOW_IDX = 20;
  const PATH: [number, number][] = [
    [0.00, norm(0.40)], // approach
    [0.04, norm(0.56)],
    [0.08, norm(0.76)],
    [0.12, norm(0.92)], // PSY area
    [0.16, bc],         // ── BC peak
    [0.20, norm(0.78)],
    [0.24, norm(0.40)],
    [0.27, ar],         // ── AR trough
    [0.31, norm(0.32)],
    [0.36, norm(0.68)],
    [0.41, norm(0.88)], // ST
    [0.46, utLevel],    // ── UT (upthrust, slightly above BC)
    [0.50, norm(0.72)],
    [0.55, norm(0.44)], // SOW phase B
    [0.59, norm(0.56)],
    [0.64, norm(0.60)], // test / bounce
    [0.68, norm(0.52)],
    [0.72, lpsyLevel],  // ── LPSY
    [0.77, norm(0.22)],
    [0.83, ar - rangeH * 0.04], // ── SOW — just breaks below AR
    /* projected breakdown from here */
    [0.88, projEnd + (sowTarget - projEnd) * 0.35],
    [0.93, projEnd + (sowTarget - projEnd) * 0.70],
    [1.00, projEnd],    // projection end
  ];

  const toX = (frac: number) => CHART_LEFT + frac * CHART_W;
  const pts = (arr: [number, number][]) => arr.map(([x, p]) => `${toX(x)},${toY(p)}`).join(" ");

  const solidPts    = PATH.slice(0, SOW_IDX + 1);
  const projPts     = PATH.slice(SOW_IDX);
  const solidStr    = pts(solidPts);
  const projStr     = pts(projPts);

  // Area fill polygon for the historical line
  const firstX = toX(PATH[0][0]);
  const lastX  = toX(PATH[SOW_IDX][0]);
  const areaStr = `${solidStr} ${lastX},${CHART_BOTTOM} ${firstX},${CHART_BOTTOM}`;

  // Annotation anchor points
  const bcX    = toX(0.16); const bcY_   = toY(bc);
  const arX_   = toX(0.27); const arY_   = toY(ar);
  const utX    = toX(0.46); const utY_   = toY(utLevel);
  const lpsyX  = toX(0.72); const lpsyY_ = toY(lpsyLevel);
  const sowX   = toX(0.83); const sowY_  = toY(ar - rangeH * 0.04);

  // Trading range box: from BC line down to AR line, PSY-to-SOW X span
  const boxLeft  = toX(0.10);
  const boxRight = toX(0.84);
  const boxTop   = toY(bc);   // higher price = lower Y in SVG
  const boxBot   = toY(ar);

  // Current price dot — pin to LPSY area if distributing, to breakdown if broken down
  const cpX = currentPhase === "breakdown" ? toX(0.88) : lpsyX;
  const cp  = currentPrice > 0 ? currentPrice : lpsyLevel;
  const cpY_ = toY(cp);

  // X-axis: anchor "now" at the SOW point
  const MS_PER_POINT = 10 * 86_400_000;
  const today = new Date();
  const chartStartMs = today.getTime() - SOW_IDX * MS_PER_POINT;
  const chartEndMs   = today.getTime() + (PATH.length - SOW_IDX) * MS_PER_POINT;
  const xLabels = generateXLabels(chartStartMs, chartEndMs);

  // Y-axis grid — only meaningful levels, skip any that crowd each other
  const gridLevels = [projEnd, ar, lpsyLevel, bc].filter((v, _, arr) =>
    arr.every((other, j) => other === v || Math.abs(toY(v) - toY(other)) >= 14)
  );

  const WYCKOFF_GRAD = "wycDistGrad";

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label="Wyckoff Distribution chart"
      >
        <defs>
          <linearGradient id={WYCKOFF_GRAD} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent-primary)" stopOpacity={0.10} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Grid at key price levels ── */}
        {gridLevels.map((p, i) => (
          <g key={i}>
            <line x1={CHART_LEFT} y1={toY(p)} x2={CHART_RIGHT} y2={toY(p)} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <text x={CHART_RIGHT + 6} y={toY(p) + 3.5} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start">
              {formatPrice(p, yMax)}
            </text>
          </g>
        ))}

        {/* ── Trading range box (BC → AR) ── */}
        <rect x={boxLeft} y={boxTop} width={boxRight - boxLeft} height={boxBot - boxTop} fill="var(--semantic-negative)" opacity={0.05} />

        {/* BC dashed line (top of range) */}
        <line x1={boxLeft} y1={bcY_} x2={boxRight} y2={bcY_} stroke="var(--semantic-negative)" strokeWidth={0.5} strokeDasharray="4,4" opacity={0.35} />

        {/* AR dashed line (support / breakdown trigger) — extends full width */}
        <line x1={CHART_LEFT} y1={arY_} x2={CHART_RIGHT} y2={arY_} stroke="var(--semantic-warning)" strokeWidth={0.75} strokeDasharray="6,3" opacity={0.45} />

        {/* LPSY confirmation line (if available) */}
        {lpsy !== null && (
          <line x1={CHART_LEFT} y1={lpsyY_} x2={CHART_RIGHT} y2={lpsyY_} stroke="var(--semantic-warning)" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.28} />
        )}

        {/* ── Price area fill ── */}
        <polygon points={areaStr} fill={`url(#${WYCKOFF_GRAD})`} />

        {/* ── Solid historical price line ── */}
        <polyline points={solidStr} stroke="var(--accent-primary)" strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

        {/* ── Dashed projected breakdown ── */}
        <polyline points={projStr} stroke="var(--semantic-negative)" strokeWidth={1} fill="none" strokeDasharray="4,4" opacity={0.55} />

        {/* ── LPSY amber oval ── */}
        <ellipse cx={lpsyX} cy={lpsyY_} rx={18} ry={11} fill="none" stroke="var(--semantic-warning)" strokeWidth={1.5} opacity={0.75} />

        {/* ── Phase labels ── */}
        <text x={bcX}   y={bcY_   - 8}  style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" fontWeight={500} opacity={0.85}>BC</text>
        <text x={arX_}  y={arY_   + 16} style={{ fill: "var(--semantic-warning)" }}  fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" fontWeight={500} opacity={0.85}>AR</text>
        <text x={utX}   y={utY_   - 8}  style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" fontWeight={500} opacity={0.80}>UT</text>
        <text x={lpsyX} y={lpsyY_ - 20} style={{ fill: "var(--semantic-warning)" }}  fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" fontWeight={500} opacity={0.90}>LPSY</text>
        <text x={sowX}  y={sowY_  + 16} style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle" fontWeight={500} opacity={0.85}>SOW</text>

        {/* ── Right-side level labels ── */}
        <text x={CHART_RIGHT + 6} y={bcY_  + 3.5} style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.75}>BC</text>
        <text x={CHART_RIGHT + 6} y={arY_  + 3.5} style={{ fill: "var(--semantic-warning)" }}  fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.75}>AR</text>
        {lpsy !== null && (
          <text x={CHART_RIGHT + 6} y={lpsyY_ + 3.5} style={{ fill: "var(--semantic-warning)" }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.70}>LPSY</text>
        )}

        {/* ── Current price dot ── */}
        <PriceDot x={cpX} y={cpY_} price={cp} />

        {/* ── X-axis labels ── */}
        <g>
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={VIEW_H - 4} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* ── Legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        {[
          { color: "var(--accent-primary)",    label: "Price",                              dot: true,  dash: false },
          { color: "var(--semantic-negative)", label: `Breakdown ↓ ${formatPrice(ar, yMax)}`, dot: false, dash: true  },
          { color: "var(--semantic-warning)",  label: `AR ${formatPrice(ar, yMax)}`,           dot: false, dash: false },
          { color: "var(--semantic-negative)", label: `BC ${formatPrice(bc, yMax)}`,            dot: false, dash: false },
          ...(lpsy !== null ? [{ color: "var(--semantic-warning)", label: `LPSY ${formatPrice(lpsyLevel, yMax)}`, dot: false, dash: false }] : []),
        ].map(({ color, label, dot, dash }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dot ? (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 14, height: 0, borderTop: `${dash ? "1px dashed" : "1.5px solid"} ${color}`, opacity: 0.7, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Watch / Symmetrical Triangle chart ───────────────────────────────────────

function WatchTriangleChart({
  data,
  currentPrice,
}: {
  data: ChartData;
  currentPrice: number;
}) {
  const { targetHigh: upperPrice, targetLow: lowerPrice, confirmation } = data;

  // Fallback when trendline levels haven't been extracted yet
  if (!upperPrice || !lowerPrice) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
        Keep Watch — awaiting trendline levels
      </div>
    );
  }

  const midPrice = currentPrice > 0 ? currentPrice : (confirmation ?? (upperPrice + lowerPrice) / 2);

  // Anchor the time axis to today. Each data point ≈ 10 days (weekly bars).
  const MS_PER_POINT = 10 * 86_400_000;
  const today = new Date();
  const chartStartMs = today.getTime() - data.prices.length * MS_PER_POINT;
  const chartEndMs   = today.getTime() + data.projected.length * MS_PER_POINT;
  const totalMs = chartEndMs - chartStartMs;

  const xLabels = generateXLabels(chartStartMs, chartEndMs);

  // Apex X: the point where the price data ends (= "now")
  const apexFraction = data.prices.length * MS_PER_POINT / totalMs;

  // Use a Y range tightly bound to the triangle spread — if we use the full chart
  // data range (which comes from the geometry pass and can span 10-20%), the trendlines
  // end up nearly horizontal and the triangle disappears. Instead, pad by 50% of the
  // spread above/below so the converging lines have visible slope.
  const spread = upperPrice - lowerPrice;
  const padding = Math.max(spread * 0.55, 1);
  const watchYMin = lowerPrice - padding;
  const watchYMax = upperPrice + padding;
  const toY = (p: number) => yAt(p, watchYMin, watchYMax);

  // Apex X: where the price data ends = "now". Clamp to 70–85% for visual balance.
  const apexX = CHART_LEFT + Math.max(0.70, Math.min(0.85, apexFraction)) * CHART_W;

  // Trendline start positions — extrapolate so lines use most of the available headroom
  // giving the triangle visible converging slope across the chart width
  const upperStartPrice = upperPrice + padding * 0.84;
  const lowerStartPrice = lowerPrice - padding * 0.84;

  const upperEndY = toY(upperPrice);
  const lowerEndY = toY(lowerPrice);
  const upperStartY = toY(upperStartPrice);
  const lowerStartY = toY(lowerStartPrice);
  const midY = toY(midPrice);

  // Grid — 4 steps across the tight Y range, skip levels that overlap trendline labels
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const price = watchYMin + (i / gridSteps) * (watchYMax - watchYMin);
    // Skip grid lines that are within 3% of the trendline endpoint labels
    const tooClose = [upperPrice, lowerPrice].some(
      (lvl) => Math.abs(price - lvl) / (watchYMax - watchYMin) < 0.08
    );
    return { price, y: toY(price), skip: tooClose };
  });

  // Price line points — recompute against the tight Y range so the line
  // sits correctly within the triangle rather than being pinned to the
  // original (much wider) geometry-pass Y bounds.
  const totalPoints = data.prices.length + data.projected.length;
  const pricePoints: [number, number][] = data.prices.map((p, i) => [
    xAt(i, totalPoints),
    toY(p),
  ]);
  const projectedPoints: [number, number][] = data.projected.map((p, i) => [
    xAt(data.prices.length + i, totalPoints),
    toY(p),
  ]);
  const lastPricePoint = pricePoints[pricePoints.length - 1];
  const dotX = lastPricePoint?.[0] ?? apexX;
  const dotY = toY(midPrice);

  // Arrow geometry
  const arrowLen = 22;
  const arrowHead = 5;
  const arrowGap = 7;

  const WATCH_GRADIENT_ID = "watchPriceGradient";

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label="Keep Watch — Symmetrical Triangle"
      >
        <defs>
          <linearGradient id={WATCH_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.1} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Grid lines — skip levels that would overlap trendline endpoint labels */}
        <g>
          {gridLines.map(({ y, price, skip }, i) =>
            skip ? null : (
              <g key={i}>
                <line x1={CHART_LEFT} y1={y} x2={CHART_RIGHT} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
                <text x={CHART_RIGHT + 6} y={y + 3.5} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start">
                  {formatPrice(price, watchYMax)}
                </text>
              </g>
            )
          )}
        </g>

        {/* Triangle fill */}
        <polygon
          points={`${CHART_LEFT},${upperStartY} ${apexX},${upperEndY} ${apexX},${lowerEndY} ${CHART_LEFT},${lowerStartY}`}
          fill="var(--accent-primary)"
          opacity={0.03}
        />

        {/* Price line + area fill — rendered inside the triangle, below the trendlines */}
        {pricePoints.length > 1 && (
          <PriceLine
            pricePoints={pricePoints}
            projectedPoints={projectedPoints}
            gradientId={WATCH_GRADIENT_ID}
            chartBottom={CHART_BOTTOM}
          />
        )}

        {/* Current price dot */}
        {pricePoints.length > 0 && (
          <PriceDot x={dotX} y={dotY} price={midPrice} />
        )}

        {/* Upper trendline — breaks above = bullish */}
        <line x1={CHART_LEFT} y1={upperStartY} x2={apexX} y2={upperEndY} stroke="var(--semantic-positive)" strokeWidth={1.5} opacity={0.55} />

        {/* Lower trendline — breaks below = bearish */}
        <line x1={CHART_LEFT} y1={lowerStartY} x2={apexX} y2={lowerEndY} stroke="var(--semantic-negative)" strokeWidth={1.5} opacity={0.55} />

        {/* Dashed vertical at apex (resolution point) */}
        <line x1={apexX} y1={CHART_TOP} x2={apexX} y2={CHART_BOTTOM} stroke="rgba(255,255,255,0.1)" strokeWidth={0.75} strokeDasharray="3,4" />

        {/* Up arrow at apex (bullish breakout) */}
        <g opacity={0.7}>
          <line x1={apexX} y1={upperEndY - arrowGap} x2={apexX} y2={upperEndY - arrowGap - arrowLen} stroke="var(--semantic-positive)" strokeWidth={1.5} strokeLinecap="round" />
          <path d={`M ${apexX - arrowHead} ${upperEndY - arrowGap - arrowLen + arrowHead} L ${apexX} ${upperEndY - arrowGap - arrowLen} L ${apexX + arrowHead} ${upperEndY - arrowGap - arrowLen + arrowHead}`} stroke="var(--semantic-positive)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Down arrow at apex (bearish breakdown) */}
        <g opacity={0.7}>
          <line x1={apexX} y1={lowerEndY + arrowGap} x2={apexX} y2={lowerEndY + arrowGap + arrowLen} stroke="var(--semantic-negative)" strokeWidth={1.5} strokeLinecap="round" />
          <path d={`M ${apexX - arrowHead} ${lowerEndY + arrowGap + arrowLen - arrowHead} L ${apexX} ${lowerEndY + arrowGap + arrowLen} L ${apexX + arrowHead} ${lowerEndY + arrowGap + arrowLen - arrowHead}`} stroke="var(--semantic-negative)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Level labels (right side) */}
        <text x={CHART_RIGHT + 6} y={upperEndY + 3.5} style={{ fill: "var(--semantic-positive)" }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.85}>
          {formatPrice(upperPrice, watchYMax)}
        </text>
        <text x={CHART_RIGHT + 6} y={lowerEndY + 3.5} style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.85}>
          {formatPrice(lowerPrice, watchYMax)}
        </text>
        <text x={CHART_RIGHT + 6} y={midY + 3.5} style={{ fill: "var(--text-tertiary)" }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start">
          {formatPrice(midPrice, watchYMax)}
        </text>

        {/* X-axis labels — auto-formatted by time span (DD/MM · MMM · 'YY) */}
        <g>
          {xLabels.map(({ label, x }, i) => (
            <text key={i} x={x} y={VIEW_H - 4} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle">
              {label}
            </text>
          ))}
        </g>
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        {[
          { color: "var(--accent-primary)", label: "Price", dot: true },
          { color: "var(--semantic-positive)", label: `Breakout ↑ ${formatPrice(upperPrice, watchYMax)}`, dot: false },
          { color: "var(--semantic-negative)", label: `Breakdown ↓ ${formatPrice(lowerPrice, watchYMax)}`, dot: false },
        ].map(({ color, label, dot }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dot ? (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 14, height: 0, borderTop: `1.5px solid ${color}`, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function TradeSummaryChart({
  data,
  direction,
  currentPrice,
  priceHistory,
}: TradeSummaryChartProps) {
  // Real Polygon data takes priority over schematic templates
  if (priceHistory && priceHistory.length >= 5) {
    return <RealPriceChart bars={priceHistory} data={data} direction={direction} />;
  }

  // Pattern-specific templates
  if (data.patternType === "head_and_shoulders" && data.headAndShouldersKeyPoints) {
    return <HeadAndShouldersChart data={data} currentPrice={currentPrice} />;
  }
  if (
    (data.patternType === "ascending_channel" || data.patternType === "descending_channel") &&
    data.channelKeyPoints
  ) {
    return <ChannelChart data={data} currentPrice={currentPrice} />;
  }
  if (data.patternType === "flag" && data.channelKeyPoints) {
    return <FlagChart data={data} currentPrice={currentPrice} />;
  }
  if (data.patternType === "distribution" && data.wyckoffKeyPoints) {
    return <WyckoffDistributionChart data={data} currentPrice={currentPrice} />;
  }
  if (data.patternType === "broadening_top" && data.broadeningTopKeyPoints) {
    return <BroadeningTopChart data={data} currentPrice={currentPrice} />;
  }
  if (data.patternType === "step_down" && data.stepDownKeyPoints) {
    return <StepDownChart data={data} currentPrice={currentPrice} />;
  }
  if (
    (data.patternType === "double_top" || data.patternType === "double_bottom") &&
    data.doubleTopBottomKeyPoints
  ) {
    return <DoublePatternChart data={data} currentPrice={currentPrice} />;
  }

  // Watch setups get the triangle visualization instead of the directional chart
  if (direction === "watch") {
    return <WatchTriangleChart data={data} currentPrice={currentPrice} />;
  }

  const { prices, projected, yMin, yMax, targetLow, targetHigh, confirmation, stopLoss, months, timeWindow, channelUpper, channelLower } = data;

  const totalPoints = prices.length + projected.length;

  // Convert price arrays to pixel coordinates
  const pricePoints: [number, number][] = prices.map((p, i) => [
    xAt(i, totalPoints),
    yAt(p, yMin, yMax),
  ]);

  const projectedPoints: [number, number][] = projected.map((p, i) => [
    xAt(prices.length + i, totalPoints),
    yAt(p, yMin, yMax),
  ]);

  // Current price dot: X from last real price point, Y always from currentPrice.
  // Using lastPricePoint[1] would misplace the dot when the traced shape doesn't
  // end exactly at the live price — always pin Y to the actual price value.
  const lastPricePoint = pricePoints[pricePoints.length - 1];
  const dotX = lastPricePoint?.[0] ?? CHART_RIGHT;
  const dotY = yAt(currentPrice, yMin, yMax);

  // Level Y coordinates
  const targetLowY = targetLow !== null ? yAt(targetLow, yMin, yMax) : null;
  const targetHighY = targetHigh !== null ? yAt(targetHigh, yMin, yMax) : null;
  const confirmationY = confirmation !== null ? yAt(confirmation, yMin, yMax) : null;
  const stopLossY = stopLoss !== null ? yAt(stopLoss, yMin, yMax) : null;

  // Time window X coordinates
  const windowXStart = timeWindow ? xAt(timeWindow.startIdx, totalPoints) : null;
  const windowXEnd = timeWindow ? xAt(timeWindow.endIdx, totalPoints) : null;

  // Target zone fill — only when targets form a tight range (≤5% gap).
  // When targets are far apart they are tiered levels, not a range band.
  const targetGapPct =
    targetLow !== null && targetHigh !== null && targetHigh > 0
      ? (targetHigh - targetLow) / targetHigh
      : 0;
  const isTieredTargets = targetGapPct > 0.05;

  const targetZone =
    targetLowY !== null && targetHighY !== null && !isTieredTargets
      ? {
          yTop: Math.min(targetLowY, targetHighY),
          yBottom: Math.max(targetLowY, targetHighY),
        }
      : null;

  // Y-axis grid lines (5 steps)
  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const price = yMin + (i / gridSteps) * (yMax - yMin);
    return { price, y: yAt(price, yMin, yMax) };
  });

  // Channel lines
  const channelUpperPoints: [number, number][] | null = channelUpper
    ? channelUpper.slice(0, totalPoints).map((p, i) => [xAt(i, totalPoints), yAt(p, yMin, yMax)])
    : null;
  const channelLowerPoints: [number, number][] | null = channelLower
    ? channelLower.slice(0, totalPoints).map((p, i) => [xAt(i, totalPoints), yAt(p, yMin, yMax)])
    : null;

  // Legend items (only show what we have data for)
  const legendItems = [
    { color: "var(--accent-primary)", label: "Price", type: "dot" as const },
    ...(projected.length > 0 ? [{ color: "var(--accent-primary)", label: "Projected", type: "dash" as const }] : []),
    ...(isTieredTargets
      ? [{ color: "var(--semantic-positive)", label: "Targets", type: "dash" as const }]
      : targetZone
      ? [{ color: "var(--semantic-positive)", label: "Target zone", type: "dot" as const }]
      : (targetHighY !== null || targetLowY !== null)
      ? [{ color: "var(--semantic-positive)", label: "Target", type: "dash" as const }]
      : []),
    ...(confirmation !== null ? [{ color: "var(--semantic-warning)", label: "Confirmation", type: "dot" as const }] : []),
    ...(stopLoss !== null ? [{ color: "var(--semantic-negative)", label: "Stop", type: "dot" as const }] : []),
  ];

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label="Trade summary chart"
      >
        <defs>
          {/* Price area gradient: accent-primary 12% → 0% */}
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Layer 1: Y-axis grid lines ── */}
        <g>
          {gridLines.map(({ y, price }, i) => (
            <g key={i}>
              <line
                x1={CHART_LEFT}
                y1={y}
                x2={CHART_RIGHT}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={0.5}
              />
              {/* Y-axis label (right side) */}
              <text
                x={CHART_RIGHT + 6}
                y={y + 3.5}
                style={{ fill: "var(--text-tertiary)" }}
                fontSize={10}
                fontFamily="'DM Mono', monospace"
                textAnchor="start"
              >
                {formatPrice(price, yMax)}
              </text>
            </g>
          ))}
        </g>

        {/* ── Layer 2: Time window band ── */}
        {timeWindow && windowXStart !== null && windowXEnd !== null && (
          <TimeWindowOverlay
            xStart={windowXStart}
            xEnd={windowXEnd}
            yTop={CHART_TOP}
            yBottom={CHART_BOTTOM}
            label={timeWindow.label}
            duration={timeWindow.duration}
            targetZone={targetZone ?? undefined}
          />
        )}

        {/* ── Layer 3: Target zone fill (when no time window) ── */}
        {!timeWindow && targetZone && (
          <rect
            x={CHART_LEFT}
            y={targetZone.yTop}
            width={CHART_W}
            height={targetZone.yBottom - targetZone.yTop}
            style={{ fill: "var(--semantic-positive)" }}
            opacity={0.07}
          />
        )}

        {/* ── Layer 4: Level lines ── */}
        {/* Target high */}
        {targetHighY !== null && targetHigh !== null && (
          <ChartLevelLine
            y={targetHighY}
            xLeft={CHART_LEFT}
            xRight={CHART_RIGHT}
            color="var(--semantic-positive)"
            strokeWidth={0.5}
            dashArray="4,4"
            opacity={0.4}
            label={isTieredTargets
              ? `Target #${direction === "short" ? 1 : 2} $${formatPrice(targetHigh, yMax)}`
              : `Target $${formatPrice(targetHigh, yMax)}`}
          />
        )}
        {/* Target low (only if different from high) */}
        {targetLowY !== null && targetLow !== null && targetLow !== targetHigh && (
          <ChartLevelLine
            y={targetLowY}
            xLeft={CHART_LEFT}
            xRight={CHART_RIGHT}
            color="var(--semantic-positive)"
            strokeWidth={0.5}
            dashArray="4,4"
            opacity={0.4}
            label={isTieredTargets
              ? `Target #${direction === "short" ? 2 : 1} $${formatPrice(targetLow, yMax)}`
              : `Target $${formatPrice(targetLow, yMax)}`}
          />
        )}
        {/* Confirmation */}
        {confirmationY !== null && confirmation !== null && (
          <ChartLevelLine
            y={confirmationY}
            xLeft={CHART_LEFT}
            xRight={CHART_RIGHT}
            color="var(--semantic-warning)"
            strokeWidth={0.75}
            dashArray="6,3"
            opacity={0.5}
            label={`Conf. $${formatPrice(confirmation, yMax)}`}
          />
        )}
        {/* Stop loss */}
        {stopLossY !== null && stopLoss !== null && (
          <ChartLevelLine
            y={stopLossY}
            xLeft={CHART_LEFT}
            xRight={CHART_RIGHT}
            color="var(--semantic-negative)"
            strokeWidth={0.75}
            dashArray="3,3"
            opacity={0.45}
            label={`Stop $${formatPrice(stopLoss, yMax)}`}
            labelBelow={direction === "long"} // stop is below price for longs
          />
        )}

        {/* ── Channel lines (optional) ── */}
        {channelUpperPoints && (
          <polyline
            points={channelUpperPoints.map(([x, y]) => `${x},${y}`).join(" ")}
            style={{ stroke: "var(--text-tertiary)" }}
            strokeWidth={0.5}
            strokeDasharray="3,4"
            fill="none"
            opacity={0.3}
          />
        )}
        {channelLowerPoints && (
          <polyline
            points={channelLowerPoints.map(([x, y]) => `${x},${y}`).join(" ")}
            style={{ stroke: "var(--text-tertiary)" }}
            strokeWidth={0.5}
            strokeDasharray="3,4"
            fill="none"
            opacity={0.3}
          />
        )}

        {/* ── Layers 5–7: Price area, price line, projected ── */}
        <PriceLine
          pricePoints={pricePoints}
          projectedPoints={projectedPoints}
          gradientId={GRADIENT_ID}
          chartBottom={CHART_BOTTOM}
        />

        {/* ── Layers 8–9: Current price dot + badge ── */}
        <PriceDot x={dotX} y={dotY} price={currentPrice} />

        {/* ── X-axis labels ── */}
        <g>
          {months.map((month, i) => {
            const t = months.length <= 1 ? 0.5 : i / (months.length - 1);
            const x = CHART_LEFT + t * CHART_W;
            return (
              <text
                key={i}
                x={x}
                y={VIEW_H - 4}
                style={{ fill: "var(--text-tertiary)" }}
                fontSize={10}
                fontFamily="'DM Sans', system-ui, sans-serif"
                textAnchor="middle"
              >
                {month}
              </text>
            );
          })}
        </g>
      </svg>

      {/* ── Legend (HTML, below SVG) ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "8px 0 4px",
          flexWrap: "wrap",
        }}
      >
        {legendItems.map(({ color, label, type }) => (
          <div
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            {type === "dot" ? (
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 14,
                  height: 0,
                  borderTop: `1px dashed ${color}`,
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step-Down chart ──────────────────────────────────────────────────────────
//
// Bearish stair-step pattern: an overall descending resistance trendline with
// multiple flat horizontal consolidation zones ("steps") separated by sharp
// nearly-vertical drops. Each step has internal dashed quartile lines matching
// Coach's TradingView annotation style.
//
// Structure: diagonal resistance line (blue) + 2 step boxes + canonical price
// path (oscillates in step → drops → oscillates in lower step) + projected
// breakdown timing (dashed vertical at right edge).

function StepDownChart({
  data,
  currentPrice,
}: {
  data: ChartData;
  currentPrice: number;
}) {
  const kp = data.stepDownKeyPoints;
  if (!kp || kp.steps.length < 2) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>
        Step-down — awaiting price levels
      </div>
    );
  }

  const { resistanceStart, resistanceEnd, steps, target } = kp;

  // Dynamic step support — works with 2, 3, or more steps
  const step1 = steps[0]; // upper (broken)
  const step2 = steps[steps.length - 1]; // lower (active)
  const numSteps = steps.length;

  // ── Y-axis range ─────────────────────────────────────────────────────────
  const s2h = step2.upper - step2.lower; // active step height
  const targetPrice = target ?? (step2.lower - s2h * 0.9);
  const allPrices = [
    resistanceStart,
    ...steps.flatMap(s => [s.upper, s.lower]),
    targetPrice,
    currentPrice > 0 ? currentPrice : step2.lower,
  ];
  const rawMin = Math.min(...allPrices) - s2h * 0.5;
  const rawMax = Math.max(...allPrices) + (step1.upper - step1.lower) * 0.4;
  const yMin = rawMin;
  const yMax = rawMax;

  const toY = (p: number) => yAt(p, yMin, yMax);
  const toX = (f: number) => CHART_LEFT + f * CHART_W;

  // ── Canonical path (dynamic for N steps) ─────────────────────────────────
  //
  // Layout strategy:
  //   0.00–0.10         Approach from above (descending toward step 1 top)
  //   Per step:         consolidation zone (proportional width, broken steps get less space)
  //   Between steps:    sharp inter-step drop (8% each)
  //   After last step:  10% open space (box extends, projected breakdown vertical)
  //
  const inStep = (step: typeof step1, n: number) => step.lower + n * (step.upper - step.lower);

  // Calculate x-ranges for each step dynamically
  const approachWidth = 0.10;
  const dropWidth = 0.08;
  const trailingSpace = 0.17; // space after last step for projected breakdown
  const totalDrops = numSteps - 1;
  const availableForSteps = 1.0 - approachWidth - totalDrops * dropWidth - trailingSpace;
  // Active step gets less chart width (still consolidating), broken steps share the rest
  const brokenStepShare = numSteps > 1 ? 0.7 : 1.0;
  const activeStepShare = 1.0 - brokenStepShare;
  const brokenCount = numSteps - 1;
  const perBrokenWidth = brokenCount > 0 ? (availableForSteps * brokenStepShare) / brokenCount : 0;
  const activeWidth = availableForSteps * activeStepShare;

  // Build x-ranges: [{xStart, xEnd}, ...]
  const stepRanges: { xStart: number; xEnd: number }[] = [];
  let cursor = approachWidth;
  for (let i = 0; i < numSteps; i++) {
    const w = i < numSteps - 1 ? perBrokenWidth : activeWidth;
    stepRanges.push({ xStart: cursor, xEnd: cursor + w });
    cursor += w;
    if (i < numSteps - 1) cursor += dropWidth; // inter-step drop
  }

  // Build PATH dynamically
  const PATH: [number, number][] = [];

  // Approach from above
  PATH.push([0.00, inStep(step1, 2.20)]);
  PATH.push([approachWidth * 0.4, inStep(step1, 1.80)]);
  PATH.push([approachWidth * 0.8, inStep(step1, 1.35)]);
  PATH.push([approachWidth, inStep(step1, 1.00)]);

  for (let i = 0; i < numSteps; i++) {
    const step = steps[i];
    const { xStart, xEnd } = stepRanges[i];
    const w = xEnd - xStart;
    const isLast = i === numSteps - 1;

    // Consolidation oscillation within this step
    if (isLast) {
      // Active step — fewer oscillations, ends at "now"
      PATH.push([xStart + w * 0.12, inStep(step, 0.82)]);
      PATH.push([xStart + w * 0.30, inStep(step, 0.36)]);
      PATH.push([xStart + w * 0.50, inStep(step, 0.66)]);
      PATH.push([xStart + w * 0.70, inStep(step, 0.78)]);
      PATH.push([xStart + w * 0.85, inStep(step, 0.44)]);
      PATH.push([xEnd,              inStep(step, 0.58)]); // "now"
    } else {
      // Broken step — full oscillation with divergence pattern
      PATH.push([xStart + w * 0.08, inStep(step, 0.74)]);
      PATH.push([xStart + w * 0.20, inStep(step, 0.91)]);
      PATH.push([xStart + w * 0.30, inStep(step, 0.99)]);
      PATH.push([xStart + w * 0.42, inStep(step, 0.67)]);
      PATH.push([xStart + w * 0.55, inStep(step, 0.85)]);
      PATH.push([xStart + w * 0.68, inStep(step, 0.96)]);
      PATH.push([xStart + w * 0.80, inStep(step, 0.60)]);
      PATH.push([xStart + w * 0.92, inStep(step, 0.92)]);
      PATH.push([xEnd,              inStep(step, 0.20)]);

      // Sharp inter-step drop to next step
      const nextStep = steps[i + 1];
      const nextXStart = stepRanges[i + 1].xStart;
      const midX = (xEnd + nextXStart) / 2;
      const nextH = nextStep.upper - nextStep.lower;
      PATH.push([midX * 0.4 + xEnd * 0.6, inStep(step, -0.20)]);
      PATH.push([midX,                     nextStep.upper + nextH * 0.5]);
      PATH.push([nextXStart,               nextStep.upper + nextH * 0.05]);
    }
  }

  const pts = (arr: [number, number][]) =>
    arr.map(([x, p]) => `${toX(x)},${toY(p)}`).join(" ");

  const lineStr = pts(PATH);

  // Area fill polygon under the full path
  const firstX  = toX(PATH[0][0]);
  const lastX   = toX(PATH[PATH.length - 1][0]);
  const areaStr = `${lineStr} ${lastX},${CHART_BOTTOM} ${firstX},${CHART_BOTTOM}`;

  // ── Diagonal resistance line ─────────────────────────────────────────────
  const diagY1 = toY(resistanceStart);
  const diagY2 = toY(resistanceEnd);

  // ── Step box helpers ─────────────────────────────────────────────────────
  function StepBox({ step, xStart, xEnd }: { step: typeof step1; xStart: number; xEnd: number }) {
    const boxTop    = toY(step.upper);
    const boxBottom = toY(step.lower);
    const boxH      = boxBottom - boxTop;
    const isBroken  = step.phase === "broken";
    const fillColor   = isBroken ? "rgba(100,120,180,0.07)" : "rgba(100,140,200,0.11)";
    const strokeColor = isBroken ? "rgba(100,120,180,0.28)" : "rgba(100,160,220,0.48)";
    return (
      <>
        <rect
          x={xStart} y={boxTop}
          width={xEnd - xStart} height={boxH}
          fill={fillColor}
          stroke={strokeColor} strokeWidth={0.75}
        />
        {/* Internal dashed quartile lines at 25%, 50%, 75% of box height */}
        {[0.25, 0.50, 0.75].map((frac, i) => (
          <line
            key={i}
            x1={xStart} y1={boxTop + boxH * frac}
            x2={xEnd}   y2={boxTop + boxH * frac}
            stroke={strokeColor}
            strokeWidth={0.5}
            strokeDasharray="5,5"
            opacity={i === 1 ? 0.8 : 0.5}
          />
        ))}
      </>
    );
  }

  // Step box positions from dynamic layout
  // Active step box extends 10% beyond its consolidation end to show projected breakdown
  const lastRange = stepRanges[stepRanges.length - 1];
  const projXFrac = lastRange.xEnd + 0.10;
  const projX = toX(projXFrac);

  // ── Target dashed horizontal ─────────────────────────────────────────────
  const targetY_ = toY(targetPrice);

  // ── Current price dot — at end of PATH ("now") ───────────────────────────
  const cpPrice = currentPrice > 0 ? currentPrice : PATH[PATH.length - 1][1];
  const cpX = toX(PATH[PATH.length - 1][0]);
  const cpY_ = toY(cpPrice);

  // ── X-axis labels ─────────────────────────────────────────────────────────
  // Estimate time scale: ~9 days per PATH point
  const MS_PER_POINT = 9 * 86_400_000;
  const today = new Date();
  const chartStartMs = today.getTime() - (PATH.length - 1) * MS_PER_POINT;
  const chartEndMs   = today.getTime() + 7 * MS_PER_POINT;
  const xLabels = generateXLabels(chartStartMs, chartEndMs);

  // ── Y-axis labels ────────────────────────────────────────────────────────
  const yLabelLevels = [step1.upper, step2.upper, step2.lower, targetPrice]
    .filter((v, _, arr) => arr.every((other) => other === v || Math.abs(toY(v) - toY(other)) >= 16));

  const SD_GRAD = "stepDownGrad";

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label="Step-down chart"
      >
        <defs>
          <linearGradient id={SD_GRAD} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent-primary)" stopOpacity={0.08} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Y-axis grid at key levels ── */}
        {yLabelLevels.map((p, i) => (
          <g key={i}>
            <line x1={CHART_LEFT} y1={toY(p)} x2={CHART_RIGHT} y2={toY(p)} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <text x={CHART_RIGHT + 6} y={toY(p) + 3.5} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start">
              {formatPrice(p, yMax)}
            </text>
          </g>
        ))}

        {/* ── Target dashed line ── */}
        <line x1={CHART_LEFT} y1={targetY_} x2={CHART_RIGHT} y2={targetY_} stroke="var(--semantic-negative)" strokeWidth={0.5} strokeDasharray="3,4" opacity={0.35} />
        <text x={CHART_RIGHT + 6} y={targetY_ + 3.5} style={{ fill: "var(--semantic-negative)" }} fontSize={9} fontFamily="'DM Mono', monospace" textAnchor="start" opacity={0.55}>
          TGT
        </text>

        {/* ── Step consolidation boxes (drawn before price line so line is on top) ── */}
        {steps.map((step, i) => {
          const range = stepRanges[i];
          const isLast = i === steps.length - 1;
          // Active step box extends to projected breakdown line
          const xEnd = isLast ? projXFrac : range.xEnd;
          return <StepBox key={i} step={step} xStart={toX(range.xStart)} xEnd={toX(xEnd)} />;
        })}

        {/* ── Diagonal resistance trendline ── */}
        <line
          x1={CHART_LEFT} y1={diagY1}
          x2={CHART_RIGHT} y2={diagY2}
          stroke="rgba(100,160,220,0.65)"
          strokeWidth={1.25}
        />

        {/* ── Price area fill ── */}
        <polygon points={areaStr} fill={`url(#${SD_GRAD})`} />

        {/* ── Price line ── */}
        <polyline
          points={lineStr}
          stroke="var(--accent-primary)" strokeWidth={1.5}
          fill="none" strokeLinejoin="round" strokeLinecap="round"
        />

        {/* ── Projected breakdown timing (dashed vertical) ── */}
        <line
          x1={projX} y1={CHART_TOP}
          x2={projX} y2={CHART_BOTTOM}
          stroke="var(--text-tertiary)"
          strokeWidth={1}
          strokeDasharray="5,4"
          opacity={0.45}
        />

        {/* ── Step labels ── */}
        {steps.map((step, i) => (
          <text
            key={`label-${i}`}
            x={toX(stepRanges[i].xStart) + 8} y={toY(step.upper) - 6}
            style={{ fill: "var(--text-secondary)" }}
            fontSize={9} fontFamily="'DM Sans', system-ui, sans-serif"
            fontStyle="italic" opacity={i === steps.length - 1 ? 0.90 : 0.75}
          >
            Step {i + 1}
          </text>
        ))}

        {/* ── Current price dot (at end of historical path = "now") ── */}
        <PriceDot x={cpX} y={cpY_} price={cpPrice} />

        {/* ── X-axis labels ── */}
        {xLabels.map(({ label, x }, i) => (
          <text key={i} x={x} y={VIEW_H - 4} style={{ fill: "var(--text-tertiary)" }} fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>

      {/* ── Legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        {[
          { color: "var(--accent-primary)",    label: "Price",      dot: true,  dash: false },
          { color: "rgba(100,160,220,0.70)",   label: "Resistance", dot: false, dash: false },
          ...steps.map((s, i) => ({
            color: i === steps.length - 1 ? "rgba(100,160,220,0.80)" : "rgba(100,120,180,0.60)",
            label: `Step ${i + 1} ${formatPrice(s.lower, yMax)}–${formatPrice(s.upper, yMax)}`,
            dot: false, dash: false,
          })),
          { color: "var(--semantic-negative)", label: `Target ${formatPrice(targetPrice, yMax)}`, dot: false, dash: true },
        ].map(({ color, label, dot, dash }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {dot ? (
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 14, height: 0, borderTop: `${dash ? "1px dashed" : "1.5px solid"} ${color}`, opacity: 0.8, flexShrink: 0 }} />
            )}
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Format a price for display — strip unnecessary decimals for large numbers. */
function formatPrice(price: number, yMax: number): string {
  if (yMax >= 1000) {
    return price >= 1000
      ? (price / 1000).toFixed(1) + "k"
      : price.toFixed(0);
  }
  return price >= 100 ? price.toFixed(0) : price.toFixed(2);
}

// ── Real Price Chart ───────────────────────────────────────────────────────
//
// Renders actual Polygon OHLC close data instead of a schematic template.
// Level overlays (confirmation, target, stop loss, pattern-specific levels)
// are drawn as dashed horizontal lines sourced from ChartData.

interface LevelSpec {
  price: number;
  label: string;
  color: string;
  dashArray: string;
  opacity: number;
}

function extractLevels(data: ChartData, direction: "long" | "short" | "watch"): LevelSpec[] {
  const levels: LevelSpec[] = [];
  const isShort = direction === "short";

  // Standard parsed levels
  if (data.confirmation != null) {
    levels.push({ price: data.confirmation, label: "CONF", color: "var(--semantic-warning)", dashArray: "6,3", opacity: 0.60 });
  }
  if (data.targetHigh != null) {
    const color = isShort ? "var(--semantic-negative)" : "var(--semantic-positive)";
    levels.push({ price: data.targetHigh, label: "TGT", color, dashArray: "4,4", opacity: 0.50 });
  }
  if (data.targetLow != null && data.targetLow !== data.targetHigh) {
    const color = isShort ? "var(--semantic-negative)" : "var(--semantic-positive)";
    levels.push({ price: data.targetLow, label: "TGT-L", color, dashArray: "4,4", opacity: 0.38 });
  }
  if (data.stopLoss != null) {
    levels.push({ price: data.stopLoss, label: "SL", color: "var(--semantic-negative)", dashArray: "3,3", opacity: 0.50 });
  }

  // Pattern-specific key levels
  if (data.headAndShouldersKeyPoints?.neckline != null) {
    levels.push({ price: data.headAndShouldersKeyPoints.neckline, label: "NL", color: "var(--semantic-warning)", dashArray: "6,3", opacity: 0.70 });
  }
  if (data.wyckoffKeyPoints) {
    const kp = data.wyckoffKeyPoints;
    if (kp.bc != null) levels.push({ price: kp.bc, label: "BC", color: "var(--semantic-negative)", dashArray: "4,4", opacity: 0.45 });
    if (kp.ar != null) levels.push({ price: kp.ar, label: "AR", color: "var(--semantic-positive)", dashArray: "4,4", opacity: 0.45 });
    if (kp.ut != null) levels.push({ price: kp.ut, label: "UT", color: "var(--semantic-negative)", dashArray: "3,3", opacity: 0.38 });
    if (kp.sow != null) levels.push({ price: kp.sow, label: "SOW", color: "var(--semantic-negative)", dashArray: "3,3", opacity: 0.55 });
    if (kp.lpsy != null) levels.push({ price: kp.lpsy, label: "LPSY", color: "var(--semantic-warning)", dashArray: "3,3", opacity: 0.45 });
  }
  if (data.doubleTopBottomKeyPoints) {
    const kp = data.doubleTopBottomKeyPoints;
    levels.push({ price: kp.doubleLevel, label: "DBL", color: "var(--semantic-negative)", dashArray: "4,4", opacity: 0.50 });
    if (kp.neckline !== kp.doubleLevel) {
      levels.push({ price: kp.neckline, label: "NL", color: "var(--semantic-warning)", dashArray: "6,3", opacity: 0.60 });
    }
  }
  if (data.broadeningTopKeyPoints) {
    const kp = data.broadeningTopKeyPoints;
    levels.push({ price: kp.upperEnd, label: "RES", color: "var(--semantic-negative)", dashArray: "4,4", opacity: 0.45 });
    levels.push({ price: kp.lowerEnd, label: "SUP", color: "var(--semantic-positive)", dashArray: "4,4", opacity: 0.45 });
  }
  if (data.channelKeyPoints) {
    const kp = data.channelKeyPoints;
    levels.push({ price: kp.upper, label: "UPR", color: "var(--text-secondary)", dashArray: "5,5", opacity: 0.40 });
    levels.push({ price: kp.lower, label: "LWR", color: "var(--text-secondary)", dashArray: "5,5", opacity: 0.40 });
  }

  // Deduplicate levels that are within 0.3% of each other
  return levels.filter((lvl, i) =>
    levels.slice(0, i).every((prev) => Math.abs(prev.price - lvl.price) / Math.max(lvl.price, 1) > 0.003)
  );
}

const REAL_GRAD_ID = "realHistoryGrad";

function RealPriceChart({
  bars,
  data,
  direction,
}: {
  bars: OHLCBar[];
  data: ChartData;
  direction: "long" | "short" | "watch";
}) {
  const timestamps = bars.map((b) => b.t);
  const closes = bars.map((b) => b.c);
  const startMs = timestamps[0];
  const endMs = timestamps[timestamps.length - 1];

  const levels = extractLevels(data, direction);
  const levelPrices = levels.map((l) => l.price);

  // Y-axis: include all closes + all levels with 6% vertical padding
  const allPrices = [...closes, ...levelPrices];
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad = (rawMax - rawMin) * 0.06;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const toX = (ts: number) =>
    CHART_LEFT + ((ts - startMs) / Math.max(endMs - startMs, 1)) * CHART_W;
  const toY = (price: number) => yAt(price, yMin, yMax);

  // SVG point strings
  const linePoints = bars.map((b) => `${toX(b.t)},${toY(b.c)}`).join(" ");
  const firstX = toX(startMs);
  const lastX = toX(endMs);
  const areaPoints = `${linePoints} ${lastX},${CHART_BOTTOM} ${firstX},${CHART_BOTTOM}`;

  // Current price = last bar close
  const lastBar = bars[bars.length - 1];
  const cpX = toX(lastBar.t);
  const cpY = toY(lastBar.c);

  // X-axis labels from real timestamps
  const xLabels = generateXLabels(startMs, endMs);

  // Y-axis grid: 5 evenly-spaced reference lines
  const gridPrices = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin));

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: "block", overflow: "visible", minHeight: 140, height: "auto" }}
        aria-label="Price history chart"
      >
        <defs>
          <linearGradient id={REAL_GRAD_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="var(--accent-primary)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Y-axis grid */}
        {gridPrices.map((p, i) => (
          <g key={i}>
            <line
              x1={CHART_LEFT} y1={toY(p)}
              x2={CHART_RIGHT} y2={toY(p)}
              stroke="rgba(255,255,255,0.04)" strokeWidth={0.5}
            />
            <text
              x={CHART_RIGHT + 6} y={toY(p) + 3.5}
              style={{ fill: "var(--text-tertiary)" }}
              fontSize={10} fontFamily="'DM Mono', monospace" textAnchor="start"
            >
              {formatPrice(p, yMax)}
            </text>
          </g>
        ))}

        {/* Level overlays */}
        {levels.map((lvl, i) => {
          const ly = toY(lvl.price);
          if (ly < CHART_TOP - 8 || ly > CHART_BOTTOM + 8) return null;
          return (
            <g key={i}>
              <line
                x1={CHART_LEFT} y1={ly} x2={CHART_RIGHT} y2={ly}
                stroke={lvl.color} strokeWidth={0.75}
                strokeDasharray={lvl.dashArray} opacity={lvl.opacity}
              />
              <text
                x={CHART_RIGHT + 6} y={ly + 3.5}
                style={{ fill: lvl.color }}
                fontSize={9} fontFamily="'DM Mono', monospace"
                textAnchor="start" opacity={Math.min(lvl.opacity + 0.15, 1)}
              >
                {lvl.label}
              </text>
            </g>
          );
        })}

        {/* Price area fill */}
        <polygon points={areaPoints} fill={`url(#${REAL_GRAD_ID})`} />

        {/* Price line */}
        <polyline
          points={linePoints}
          stroke="var(--accent-primary)" strokeWidth={1.5}
          fill="none" strokeLinejoin="round" strokeLinecap="round"
        />

        {/* Current price dot */}
        <PriceDot x={cpX} y={cpY} price={lastBar.c} />

        {/* X-axis labels */}
        {xLabels.map(({ label, x }, i) => (
          <text
            key={i} x={x} y={VIEW_H - 4}
            style={{ fill: "var(--text-tertiary)" }}
            fontSize={10} fontFamily="'DM Sans', system-ui, sans-serif" textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0 4px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            Price
          </span>
        </div>
        {levels.map((lvl) => (
          <div key={lvl.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 14, height: 0, borderTop: `1px dashed ${lvl.color}`, opacity: 0.65, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Sans', system-ui, sans-serif", whiteSpace: "nowrap" }}>
              {lvl.label} {formatPrice(lvl.price, yMax)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
