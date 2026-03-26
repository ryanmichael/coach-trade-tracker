// PriceBadge — monospace price display with semantic sentiment coloring
// Always DM Mono, weight 400. Colors from semantic tokens only.

type PriceBadgeSize = "sm" | "md" | "lg";
type PriceBadgeSentiment = "positive" | "negative" | "neutral";

export interface PriceBadgeProps {
  value: number;
  size?: PriceBadgeSize;
  /** Explicit sentiment — overrides auto-detection from value sign */
  sentiment?: PriceBadgeSentiment;
  /** Show + prefix for positive values */
  showSign?: boolean;
  /** Render as percentage change instead of dollar amount */
  isPercent?: boolean;
  className?: string;
}

const FONT_SIZES: Record<PriceBadgeSize, string> = {
  sm: "14px",
  md: "20px",
  lg: "24px",
};

const SENTIMENT_COLORS: Record<PriceBadgeSentiment, string> = {
  positive: "var(--semantic-positive)",
  negative: "var(--semantic-negative)",
  neutral: "var(--text-primary)",
};

function formatValue(value: number, showSign: boolean, isPercent: boolean): string {
  const abs = Math.abs(value);
  const prefix = showSign && value > 0 ? "+" : value < 0 ? "-" : "";
  if (isPercent) {
    return `${prefix}${abs.toFixed(2)}%`;
  }
  return `${prefix}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PriceBadge({
  value,
  size = "md",
  sentiment,
  showSign = false,
  isPercent = false,
  className = "",
}: PriceBadgeProps) {
  // If explicit sentiment provided, use it; otherwise auto-detect from sign
  const resolvedSentiment: PriceBadgeSentiment =
    sentiment ?? (value > 0 ? "positive" : value < 0 ? "negative" : "neutral");

  return (
    <span
      className={`tabular-nums leading-none ${className}`}
      style={{
        fontFamily: "var(--font-mono), 'DM Mono', 'Courier New', monospace",
        fontSize: FONT_SIZES[size],
        fontWeight: 400,
        color: SENTIMENT_COLORS[resolvedSentiment],
        letterSpacing: 0,
      }}
      data-financial
    >
      {formatValue(value, showSign, isPercent)}
    </span>
  );
}

// Named export for convenience
export { PriceBadge };
