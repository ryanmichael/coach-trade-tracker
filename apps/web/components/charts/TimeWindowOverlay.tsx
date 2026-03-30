"use client";

/**
 * TimeWindowOverlay — vertical band marking the expected time range for the
 * target to be reached. Rendered inside the TradeSummaryChart SVG.
 *
 * Includes:
 * - Semi-transparent band fill
 * - Dashed left + right edge lines
 * - Centered pill label at the top of the band
 * - Duration text below the band at the X-axis
 */

interface TimeWindowOverlayProps {
  xStart: number;
  xEnd: number;
  yTop: number;
  yBottom: number;
  label: string;
  duration: string;
  /** If provided, renders the target zone fill constrained to this X range. */
  targetZone?: {
    yTop: number;
    yBottom: number;
  };
}

export function TimeWindowOverlay({
  xStart,
  xEnd,
  yTop,
  yBottom,
  label,
  duration,
  targetZone,
}: TimeWindowOverlayProps) {
  const bandWidth = xEnd - xStart;
  const centerX = xStart + bandWidth / 2;
  const pillWidth = 88;
  const pillHeight = 16;
  const pillX = centerX - pillWidth / 2;
  const pillY = yTop + 4;

  return (
    <g>
      {/* Band fill */}
      <rect
        x={xStart}
        y={yTop}
        width={bandWidth}
        height={yBottom - yTop}
        style={{ fill: "var(--accent-primary)" }}
        opacity={0.04}
        rx={3}
      />

      {/* Target zone fill inside band */}
      {targetZone && (
        <rect
          x={xStart}
          y={targetZone.yTop}
          width={bandWidth}
          height={targetZone.yBottom - targetZone.yTop}
          style={{ fill: "var(--semantic-positive)" }}
          opacity={0.07}
        />
      )}

      {/* Left edge */}
      <line
        x1={xStart}
        y1={yTop}
        x2={xStart}
        y2={yBottom}
        style={{ stroke: "var(--accent-primary)" }}
        strokeWidth={0.5}
        strokeDasharray="3,4"
        opacity={0.2}
      />

      {/* Right edge */}
      <line
        x1={xEnd}
        y1={yTop}
        x2={xEnd}
        y2={yBottom}
        style={{ stroke: "var(--accent-primary)" }}
        strokeWidth={0.5}
        strokeDasharray="3,4"
        opacity={0.2}
      />

      {/* Top pill */}
      <rect
        x={pillX}
        y={pillY}
        width={pillWidth}
        height={pillHeight}
        style={{ fill: "var(--accent-primary)" }}
        opacity={0.12}
        rx={3}
      />
      <text
        x={centerX}
        y={pillY + pillHeight / 2 + 3.5}
        style={{ fill: "var(--accent-primary-hover)" }}
        fontSize={9}
        fontWeight={500}
        fontFamily="'DM Sans', system-ui, sans-serif"
        textAnchor="middle"
      >
        {label}
      </text>

      {/* Duration label below band */}
      <text
        x={centerX}
        y={yBottom + 14}
        style={{ fill: "var(--text-tertiary)" }}
        fontSize={9}
        fontFamily="'DM Sans', system-ui, sans-serif"
        textAnchor="middle"
      >
        {duration}
      </text>
    </g>
  );
}
