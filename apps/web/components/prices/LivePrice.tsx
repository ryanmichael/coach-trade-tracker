"use client";

// LivePrice — shows current price + day change for a single ticker.
// Reads directly from the prices Zustand store (populated by PricePoller).
// Renders nothing if no price data is available yet.

import { usePrices } from "@/hooks/usePrices";

interface LivePriceProps {
  ticker: string;
  /** Base font size for the price. Change % is rendered slightly smaller. */
  size?: number;
  /** Show the day change % badge next to the price. Default true. */
  showChange?: boolean;
}

export function LivePrice({ ticker, size = 14, showChange = true }: LivePriceProps) {
  const priceData = usePrices(ticker);

  if (!priceData || !priceData.price) return null;

  const { price, changePercent } = priceData;
  const isPositive = changePercent >= 0;
  const changeColor = isPositive ? "var(--semantic-positive)" : "var(--semantic-negative)";
  const arrow = isPositive ? "▲" : "▼";
  const changePct = `${isPositive ? "+" : ""}${changePercent.toFixed(2)}%`;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono), 'DM Mono', monospace",
          fontSize: size,
          fontWeight: 400,
          color: "var(--text-secondary)",
          letterSpacing: 0,
        }}
        data-financial
      >
        ${price.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>

      {showChange && (
        <span
          style={{
            fontFamily: "var(--font-mono), 'DM Mono', monospace",
            fontSize: Math.round(size * 0.86),
            color: changeColor,
            letterSpacing: 0,
          }}
          data-financial
        >
          {arrow} {changePct}
        </span>
      )}
    </span>
  );
}
