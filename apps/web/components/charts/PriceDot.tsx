"use client";

/**
 * PriceDot — current price indicator: a filled circle with a rounded-rect
 * badge showing the current price in DM Mono. Rendered inside the SVG.
 */

interface PriceDotProps {
  x: number;
  y: number;
  price: number;
}

export function PriceDot({ x, y, price }: PriceDotProps) {
  const label = `$${price.toFixed(2)}`;
  // Estimate badge width: roughly 6.5px per character + 8px padding
  const badgeWidth = Math.max(50, label.length * 6.5 + 12);
  const badgeHeight = 16;
  const badgeX = x + 6;
  const badgeY = y - badgeHeight / 2;

  return (
    <g>
      {/* Outer ring (bg-surface stroke) */}
      <circle
        cx={x}
        cy={y}
        r={5.5}
        style={{ fill: "var(--bg-surface)" }}
      />
      {/* Filled dot */}
      <circle
        cx={x}
        cy={y}
        r={3.5}
        style={{ fill: "var(--accent-primary)" }}
      />

      {/* Price badge */}
      <rect
        x={badgeX}
        y={badgeY}
        width={badgeWidth}
        height={badgeHeight}
        style={{ fill: "var(--accent-primary)" }}
        opacity={0.9}
        rx={3}
      />
      <text
        x={badgeX + badgeWidth / 2}
        y={badgeY + badgeHeight / 2 + 4}
        style={{ fill: "var(--text-inverse)" }}
        fontSize={9}
        fontWeight={500}
        fontFamily="'DM Mono', monospace"
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  );
}
