"use client";

// MarketStatus — standalone market open/closed chip.
// Uses the client-side useMarketStatus hook (no API call, computes from system clock).

import { useMarketStatus } from "@/hooks/useMarketStatus";
import type { MarketStatus } from "@/lib/polygon";

const CONFIG: Record<MarketStatus, { label: string; color: string; dotColor: string; pulse: boolean }> = {
  open: {
    label: "Market Open",
    color: "var(--semantic-positive)",
    dotColor: "var(--semantic-positive)",
    pulse: true,
  },
  "pre-market": {
    label: "Pre-Market",
    color: "var(--semantic-warning)",
    dotColor: "var(--semantic-warning)",
    pulse: false,
  },
  "after-hours": {
    label: "After-Hours",
    color: "var(--semantic-info)",
    dotColor: "var(--semantic-info)",
    pulse: false,
  },
  closed: {
    label: "Market Closed",
    color: "var(--text-tertiary)",
    dotColor: "var(--text-tertiary)",
    pulse: false,
  },
};

interface MarketStatusProps {
  /** Show ET clock time next to the label. Default false. */
  showTime?: boolean;
}

export function MarketStatus({ showTime = false }: MarketStatusProps) {
  const { status, etTime } = useMarketStatus();
  const cfg = CONFIG[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: cfg.color,
        whiteSpace: "nowrap",
      }}
    >
      <style>{`
        @keyframes msDotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          backgroundColor: cfg.dotColor,
          flexShrink: 0,
          animation: cfg.pulse ? "msDotPulse 2.5s ease-in-out infinite" : "none",
        }}
      />
      {cfg.label}
      {showTime && (
        <span style={{ color: "var(--text-tertiary)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
          · {etTime} ET
        </span>
      )}
    </span>
  );
}
