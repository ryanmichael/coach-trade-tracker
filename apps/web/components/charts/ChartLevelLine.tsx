"use client";

/**
 * ChartLevelLine — a horizontal dashed level line (target, confirmation, stop)
 * rendered inside the TradeSummaryChart SVG.
 */

interface ChartLevelLineProps {
  y: number;
  xLeft: number;
  xRight: number;
  color: string;
  strokeWidth: number;
  dashArray: string;
  opacity: number;
  label: string;
  labelBelow?: boolean;
}

export function ChartLevelLine({
  y,
  xLeft,
  xRight,
  color,
  strokeWidth,
  dashArray,
  opacity,
  label,
  labelBelow = false,
}: ChartLevelLineProps) {
  const labelY = labelBelow ? y + 9 : y - 3;

  return (
    <g>
      <line
        x1={xLeft}
        y1={y}
        x2={xRight}
        y2={y}
        style={{ stroke: color }}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        opacity={opacity}
      />
      <text
        x={xLeft + 2}
        y={labelY}
        style={{ fill: color }}
        fontSize={9}
        fontWeight={500}
        fontFamily="'DM Sans', system-ui, sans-serif"
        textAnchor="start"
        letterSpacing="0.04em"
        textDecoration="uppercase"
        opacity={1}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}
