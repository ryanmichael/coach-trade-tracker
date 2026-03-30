"use client";

import { useSelectionStore } from "@/stores/selection";
import ProximityBadge from "@/components/primitives/ProximityBadge";

interface TickerCardProps {
  symbol: string;
  currentPrice: number | null;
  confirmationPrice: number | null;
  direction: "long" | "short";
  hasUnreadAlert?: boolean;
  isNew?: boolean;
}

const FlagIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="var(--semantic-positive)"
    stroke="var(--semantic-positive)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

export function TickerCard({
  symbol,
  currentPrice,
  confirmationPrice,
  direction,
  hasUnreadAlert = false,
  isNew = false,
}: TickerCardProps) {
  const { selected, setSelected } = useSelectionStore();
  const isSelected = selected === symbol;

  return (
    <div
      onClick={() => setSelected(symbol)}
      className={isNew ? "ticker-new" : undefined}
      style={{
        display: "flex",
        alignItems: "stretch",
        borderRadius: "var(--radius-brand-md)",
        border: `1px solid ${isSelected ? "var(--accent-primary)" : "var(--border-default)"}`,
        background: isSelected ? "var(--accent-muted)" : "var(--bg-surface)",
        cursor: "pointer",
        userSelect: "none",
        overflow: "hidden",
        marginBottom: 8,
        transition:
          "background var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default), box-shadow 300ms ease",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "var(--bg-surface-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "var(--bg-surface)";
        }
      }}
    >
      {/* Flag column — ONLY rendered when there is an unread alert.
          The card layout changes when this column is present. */}
      {hasUnreadAlert && (
        <div
          style={{
            width: 28,
            minWidth: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: "var(--semantic-positive-muted)",
            borderRight: "1px solid var(--border-subtle)",
            animation: "flagPulse 2s ease-in-out infinite",
          }}
        >
          <style>{`
            @keyframes flagPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
          <FlagIcon />
        </div>
      )}

      {/* Card content */}
      <div style={{ flex: 1, padding: "12px 14px", minWidth: 0 }}>
        {/* Row 1: ticker + proximity badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: isSelected ? "var(--accent-primary)" : "var(--text-primary)",
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {symbol}
          </span>
          {currentPrice !== null && confirmationPrice !== null && (
            <ProximityBadge
              currentPrice={currentPrice}
              confirmationPrice={confirmationPrice}
              direction={direction}
            />
          )}
        </div>

        {/* Row 2: current price */}
        <div style={{ marginTop: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-mono), 'DM Mono', monospace",
              fontSize: 14,
              color: currentPrice !== null ? "var(--text-primary)" : "var(--text-tertiary)",
            }}
          >
            {currentPrice !== null
              ? `$${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
