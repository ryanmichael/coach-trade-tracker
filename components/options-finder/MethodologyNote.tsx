"use client";

export function MethodologyNote() {
  return (
    <div
      style={{
        marginTop: 20,
        padding: "12px 16px",
        borderRadius: 8,
        background: "var(--bg-surface-hover)",
        border: "1px solid var(--border-default)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--text-tertiary)",
          lineHeight: 1.6,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}
        >
          Methodology:{" "}
        </span>
        ROI estimates use Black-Scholes forward pricing — projecting what each
        option will be worth at the target price, including remaining time
        value (not just intrinsic). Composite score blends forward ROI (35%),
        delta proximity to 0.25–0.40 ideal range (20%), theta efficiency (15%),
        liquidity (15%), and IV level (15%). Click &quot;Scenarios&quot; on any
        contract to see 5-point analysis from no move through full target.{" "}
        <span style={{ color: "var(--semantic-positive)" }}>Green = ideal delta</span>,{" "}
        <span style={{ color: "var(--semantic-warning)" }}>yellow = acceptable</span>.
      </div>
    </div>
  );
}
