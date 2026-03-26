"use client";

import type { EnrichedContract } from "@/lib/options";
import { formatMoney, formatPct, formatDate } from "@/lib/options";

export function SummaryFooter({
  contracts,
}: {
  contracts: EnrichedContract[];
}) {
  // Find the sweet spot contract, or fall back to the first one
  const best =
    contracts.find((c) => c.isSweetSpot) ?? contracts[0];
  if (!best) return null;

  const typeLabel = best.contractType === "call" ? "C" : "P";

  return (
    <div
      style={{
        marginTop: 20,
        padding: "16px 20px",
        background: "var(--bg-surface-hover)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: "var(--text-tertiary)" }}>Best contract: </span>
        <span
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-dm-mono), monospace",
            fontWeight: 500,
          }}
        >
          {formatMoney(best.strike)} {typeLabel}
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>
          {" · " + formatDate(best.expiry) + " · "}
        </span>
        <span
          style={{
            color: "var(--semantic-positive)",
            fontFamily: "var(--font-dm-mono), monospace",
            fontWeight: 600,
          }}
        >
          {formatPct(best.forwardROI)} ROI
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>
          {" · score "}
        </span>
        <span
          style={{
            color: "var(--accent-primary)",
            fontFamily: "var(--font-dm-mono), monospace",
            fontWeight: 600,
          }}
        >
          {Math.round(best.compositeScore * 100)}
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>
          {" for " + formatMoney(best.ask) + "/contract"}
        </span>
      </div>

      <button
        onClick={() => {
          // Deep link to WeBull — fallback to ticker page
          window.open(
            `https://app.webull.com/stocks/${best.id.split(/\d/)[0] || "SPY"}`,
            "_blank"
          );
        }}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#0B0D11",
          background: "var(--accent-primary)",
          border: "none",
          borderRadius: 8,
          padding: "8px 20px",
          cursor: "pointer",
          letterSpacing: "0.01em",
        }}
      >
        Open in WeBull
      </button>
    </div>
  );
}
