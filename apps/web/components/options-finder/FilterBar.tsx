"use client";

import type { SortMode } from "@/lib/options";

interface FilterBarProps {
  sortBy: SortMode;
  onSort: (sort: SortMode) => void;
  count: number;
  contractLabel: string;
}

function SortBtn({
  label,
  value,
  active,
  onSort,
}: {
  label: string;
  value: SortMode;
  active: boolean;
  onSort: (s: SortMode) => void;
}) {
  return (
    <button
      onClick={() => onSort(value)}
      style={{
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--accent-primary)" : "var(--text-secondary)",
        background: active ? "var(--accent-muted)" : "transparent",
        border: `1px solid ${
          active ? "rgba(124,124,255,0.27)" : "var(--border-default)"
        }`,
        borderRadius: 8,
        padding: "6px 14px",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {label}
    </button>
  );
}

export function FilterBar({
  sortBy,
  onSort,
  count,
  contractLabel,
}: FilterBarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginRight: 6,
          }}
        >
          Sort by
        </span>
        <SortBtn label="Score" value="score" active={sortBy === "score"} onSort={onSort} />
        <SortBtn label="ROI" value="roi" active={sortBy === "roi"} onSort={onSort} />
        <SortBtn label="Premium" value="premium" active={sortBy === "premium"} onSort={onSort} />
        <SortBtn label="Expiry" value="expiry" active={sortBy === "expiry"} onSort={onSort} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: 11,
            color: "var(--text-tertiary)",
          }}
        >
          {count} contract{count !== 1 ? "s" : ""}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-tertiary)",
            background: "var(--bg-surface-hover)",
            padding: "3px 8px",
            borderRadius: 4,
          }}
        >
          {contractLabel} · OI &gt; 50 · Spread &lt; 20%
        </span>
      </div>
    </div>
  );
}
