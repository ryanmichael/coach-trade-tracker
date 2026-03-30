// ProgressBar — price progress from entry toward target
// 4px track (bg-elevated), semantic fill. No labels on the bar itself.
// Optional reference markers for support/resistance levels.

type TradeDirection = "long" | "short";

interface ProgressBarProps {
  /** Current price */
  currentPrice: number;
  /** Entry or confirmation price (start of range) */
  entryPrice: number;
  /** Price target (end of range) */
  targetPrice: number;
  direction?: TradeDirection;
  /** Optional stop loss marker */
  stopLoss?: number;
  /** Optional support level marker */
  supportLevel?: number;
  /** Optional resistance level marker */
  resistanceLevel?: number;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Convert a price to a 0–100% position within [low, high] */
function toPercent(price: number, low: number, high: number): number {
  if (high === low) return 0;
  return clamp(((price - low) / (high - low)) * 100, 0, 100);
}

interface LevelMarkerProps {
  percent: number;
  color: string;
  label?: string;
}

function LevelMarker({ percent, color, label }: LevelMarkerProps) {
  return (
    <div
      className="absolute top-1/2 -translate-y-1/2"
      style={{ left: `${percent}%`, transform: "translate(-50%, -50%)" }}
      title={label}
    >
      <div
        style={{
          width: "2px",
          height: "10px",
          backgroundColor: color,
          borderRadius: "1px",
          opacity: 0.7,
        }}
      />
    </div>
  );
}

export function ProgressBar({
  currentPrice,
  entryPrice,
  targetPrice,
  direction = "long",
  stopLoss,
  supportLevel,
  resistanceLevel,
  className = "",
}: ProgressBarProps) {
  // For a long: range is entry → target (left to right = progress)
  // For a short: range is target → entry (left to right = progress toward lower target)
  const low = direction === "long" ? entryPrice : targetPrice;
  const high = direction === "long" ? targetPrice : entryPrice;

  const fillPct = toPercent(currentPrice, low, high);
  const fillColor =
    direction === "long" ? "var(--semantic-positive)" : "var(--semantic-negative)";

  return (
    <div className={`relative ${className}`} style={{ height: "4px" }}>
      {/* Track */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: "9999px",
          backgroundColor: "var(--bg-elevated)",
        }}
      >
        {/* Fill */}
        <div
          style={{
            width: `${fillPct}%`,
            height: "100%",
            backgroundColor: fillColor,
            borderRadius: "9999px",
            transition: `width var(--duration-normal) var(--ease-out)`,
          }}
        />
      </div>

      {/* Optional level markers — rendered relative to the same range */}
      {stopLoss !== undefined && (
        <LevelMarker
          percent={toPercent(stopLoss, low, high)}
          color="var(--semantic-negative)"
          label={`Stop loss: $${stopLoss}`}
        />
      )}
      {supportLevel !== undefined && (
        <LevelMarker
          percent={toPercent(supportLevel, low, high)}
          color="var(--semantic-warning)"
          label={`Support: $${supportLevel}`}
        />
      )}
      {resistanceLevel !== undefined && (
        <LevelMarker
          percent={toPercent(resistanceLevel, low, high)}
          color="var(--text-tertiary)"
          label={`Resistance: $${resistanceLevel}`}
        />
      )}
    </div>
  );
}
