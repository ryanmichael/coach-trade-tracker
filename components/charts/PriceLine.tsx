"use client";

/**
 * PriceLine — renders the price curve, the area fill beneath it, and the
 * projected dashed extension. All rendered inside the TradeSummaryChart SVG.
 */

type Point = [number, number];

interface PriceLineProps {
  /** Pixel [x, y] coordinates for real historical prices. */
  pricePoints: Point[];
  /** Pixel [x, y] coordinates for the projected price path. */
  projectedPoints: Point[];
  /** ID for the linearGradient defined in <defs>. */
  gradientId: string;
  /** Y pixel coordinate of the chart bottom (for closing the area fill). */
  chartBottom: number;
}

/** Convert an array of [x, y] points to an SVG path `d` string using lines. */
function toPathD(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${first[0]},${first[1]} ${rest.map(([x, y]) => `L ${x},${y}`).join(" ")}`;
}

export function PriceLine({
  pricePoints,
  projectedPoints,
  gradientId,
  chartBottom,
}: PriceLineProps) {
  if (pricePoints.length === 0) return null;

  const firstX = pricePoints[0][0];
  const lastPrice = pricePoints[pricePoints.length - 1];

  // Area fill path: price line → down to chart bottom → back to start → close
  const areaPath = [
    toPathD(pricePoints),
    `L ${lastPrice[0]},${chartBottom}`,
    `L ${firstX},${chartBottom}`,
    "Z",
  ].join(" ");

  // Price line
  const pricePath = toPathD(pricePoints);

  // Projected path: starts from last real point
  const projectedPath =
    projectedPoints.length > 0
      ? `M ${lastPrice[0]},${lastPrice[1]} ${projectedPoints.map(([x, y]) => `L ${x},${y}`).join(" ")}`
      : "";

  return (
    <g>
      {/* Area fill under price line */}
      <path
        d={areaPath}
        fill={`url(#${gradientId})`}
        stroke="none"
      />

      {/* Solid price line */}
      <path
        d={pricePath}
        style={{ stroke: "var(--accent-primary)" }}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Projected dashed extension */}
      {projectedPath && (
        <path
          d={projectedPath}
          style={{ stroke: "var(--accent-primary)" }}
          strokeWidth={1}
          fill="none"
          strokeDasharray="4,4"
          opacity={0.35}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}
