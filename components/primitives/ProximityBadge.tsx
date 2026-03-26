// ProximityBadge — direction-aware price proximity indicator
// Shows "Confirmed ✓" when price has passed confirmation, otherwise "X.X% away"
// Color scales: red (far) → amber (getting close) → green (nearly there / confirmed)

export interface ProximityBadgeProps {
  currentPrice: number;
  confirmationPrice: number;
  direction: "long" | "short" | "watch";
  className?: string;
}

type ProximityState =
  | { confirmed: true }
  | { confirmed: false; pctAway: number };

function getProximity(
  currentPrice: number,
  confirmationPrice: number,
  direction: "long" | "short" | "watch"
): ProximityState {
  if (direction === "watch") return { confirmed: false, pctAway: 0 };
  if (direction === "long") {
    // Longs confirm when price >= confirmation
    if (currentPrice >= confirmationPrice) return { confirmed: true };
    const pctAway = ((confirmationPrice - currentPrice) / confirmationPrice) * 100;
    return { confirmed: false, pctAway };
  } else {
    // Shorts confirm when price <= confirmation
    if (currentPrice <= confirmationPrice) return { confirmed: true };
    const pctAway = ((currentPrice - confirmationPrice) / confirmationPrice) * 100;
    return { confirmed: false, pctAway };
  }
}

/** Map distance percentage to a semantic color token */
function getProximityColor(pctAway: number): string {
  if (pctAway <= 2) return "var(--semantic-positive)";
  if (pctAway <= 6) return "var(--semantic-warning)";
  return "var(--semantic-negative)";
}

function getProximityBg(pctAway: number): string {
  if (pctAway <= 2) return "var(--semantic-positive-muted)";
  if (pctAway <= 6) return "var(--semantic-warning-muted)";
  return "var(--semantic-negative-muted)";
}

export default function ProximityBadge({
  currentPrice,
  confirmationPrice,
  direction,
  className = "",
}: ProximityBadgeProps) {
  const proximity = getProximity(currentPrice, confirmationPrice, direction);

  if (proximity.confirmed) {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          borderRadius: "var(--radius-brand-sm)",
          padding: "var(--space-1) var(--space-2)",
          backgroundColor: "var(--semantic-positive-muted)",
          color: "var(--semantic-positive)",
          fontSize: "12px",
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        Confirmed ✓
      </span>
    );
  }

  const { pctAway } = proximity;
  const color = getProximityColor(pctAway);
  const bg = getProximityBg(pctAway);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "var(--radius-brand-sm)",
        padding: "var(--space-1) var(--space-2)",
        backgroundColor: bg,
        color,
        fontSize: "12px",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        fontFamily: "var(--font-mono), 'DM Mono', monospace",
      }}
      data-financial
    >
      {pctAway.toFixed(1)}% away
    </span>
  );
}

// Named export for convenience
export { ProximityBadge };
