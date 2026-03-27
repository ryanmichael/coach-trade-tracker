"use client";

import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import type { CustomTradeInput } from "@/lib/options";
import { formatMoney, formatDate } from "@/lib/options";

const TIME_RANGES = [
  { key: "1w", label: "1 Week", days: 7 },
  { key: "2w", label: "2 Weeks", days: 14 },
  { key: "3w", label: "3 Weeks", days: 21 },
  { key: "1m", label: "1 Month", days: 30 },
  { key: "2m", label: "2 Months", days: 60 },
  { key: "3m", label: "3 Months", days: 90 },
  { key: "exact", label: "Exact", days: 0 },
] as const;

type RangeKey = (typeof TIME_RANGES)[number]["key"];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function rangeLabelFromDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  for (const r of TIME_RANGES) {
    if (r.key !== "exact" && r.days === diffDays) return r.label;
  }
  // Close-enough match for display (within 2 days of a preset)
  for (const r of TIME_RANGES) {
    if (r.key !== "exact" && Math.abs(r.days - diffDays) <= 2) return `~${r.label}`;
  }
  return null;
}

interface CustomTickerFormProps {
  ticker: string;
  draft: CustomTradeInput;
  onUpdate: (draft: CustomTradeInput) => void;
}

export function CustomTickerForm({
  ticker,
  draft,
  onUpdate,
}: CustomTickerFormProps) {
  const [editing, setEditing] = useState(false);
  const [selectedRange, setSelectedRange] = useState<RangeKey | null>(null);

  function handleChange(field: keyof CustomTradeInput, value: string | number) {
    const updated = { ...draft, [field]: value };
    // Auto-derive direction from price relationship
    if (updated.currentPrice > 0 && updated.priceTargetHigh > 0) {
      updated.direction =
        updated.priceTargetHigh >= updated.currentPrice ? "LONG" : "SHORT";
    }
    onUpdate(updated);
  }

  function handleRangeSelect(range: RangeKey) {
    setSelectedRange(range);
    if (range !== "exact") {
      const r = TIME_RANGES.find((t) => t.key === range)!;
      handleChange("projectedDate", addDays(r.days));
    } else {
      // Clear date so user picks via date picker
      if (!draft.projectedDate) {
        handleChange("projectedDate", "");
      }
    }
  }

  const [fetchingPrice, setFetchingPrice] = useState(false);

  async function handleRefreshPrice() {
    if (!ticker || fetchingPrice) return;
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/prices/${encodeURIComponent(ticker)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.price) handleChange("currentPrice", data.price);
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setFetchingPrice(false);
    }
  }

  const isReady =
    draft.currentPrice > 0 &&
    draft.priceTargetHigh > 0 &&
    draft.projectedDate.length > 0;

  // Auto-derived direction for display
  const derivedDir =
    draft.currentPrice > 0 && draft.priceTargetHigh > 0
      ? draft.priceTargetHigh >= draft.currentPrice
        ? "LONG"
        : "SHORT"
      : draft.direction;

  // Compact date display for summary
  const dateDisplay =
    rangeLabelFromDate(draft.projectedDate) ?? formatDate(draft.projectedDate);

  // If form has been filled and user isn't editing, show compact summary
  if (isReady && !editing) {
    const dirColor =
      derivedDir === "LONG"
        ? "var(--semantic-positive)"
        : "var(--semantic-negative)";

    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          padding: "12px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {ticker}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: dirColor,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {derivedDir === "LONG" ? "▲ Long" : "▼ Short"}
          </span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            {formatMoney(draft.currentPrice)} → {formatMoney(draft.priceTargetHigh)}
          </span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
            }}
          >
            {dateDisplay}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: "var(--semantic-warning)",
              background: "var(--semantic-warning-muted)",
              padding: "3px 8px",
              borderRadius: 4,
              textTransform: "uppercase",
            }}
          >
            Custom
          </span>
        </div>

        <button
          onClick={() => setEditing(true)}
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--accent-primary)",
            background: "transparent",
            border: "1px solid rgba(124,124,255,0.27)",
            borderRadius: 6,
            padding: "5px 12px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Edit
        </button>
      </div>
    );
  }

  // Expanded edit form
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--font-dm-mono), monospace",
    fontSize: 13,
    background: "var(--bg-surface-hover)",
    border: "1px solid var(--border-default)",
    borderRadius: 6,
    padding: "6px 10px",
    width: 100,
    outline: "none",
  };

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px dashed rgba(240,184,95,0.27)",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {ticker}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.06em",
            color: "var(--semantic-warning)",
            background: "var(--semantic-warning-muted)",
            padding: "3px 8px",
            borderRadius: 4,
            textTransform: "uppercase",
          }}
        >
          Custom — enter trade details
        </span>
        {draft.currentPrice > 0 && draft.priceTargetHigh > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color:
                derivedDir === "LONG"
                  ? "var(--semantic-positive)"
                  : "var(--semantic-negative)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {derivedDir === "LONG" ? "▲ Long" : "▼ Short"}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        {/* Current Price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 5 }}>
            Current Price
            <RefreshCwIcon
              size={12}
              strokeWidth={2.5}
              style={{
                color: fetchingPrice ? "var(--text-tertiary)" : "var(--accent-primary)",
                cursor: fetchingPrice ? "default" : "pointer",
                animation: fetchingPrice ? "spin 3s ease-in-out infinite" : "none",
                transition: "color 0.12s ease",
                flexShrink: 0,
              }}
              onClick={handleRefreshPrice}
            />
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={draft.currentPrice > 0 ? draft.currentPrice : ""}
            onChange={(e) =>
              handleChange("currentPrice", parseFloat(e.target.value) || 0)
            }
            style={{ ...inputStyle, color: "var(--text-primary)" }}
          />
        </div>

        {/* Target Price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Target Price</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={draft.priceTargetHigh > 0 ? draft.priceTargetHigh : ""}
            onChange={(e) =>
              handleChange(
                "priceTargetHigh",
                parseFloat(e.target.value) || 0
              )
            }
            style={{ ...inputStyle, color: "var(--accent-primary)" }}
          />
        </div>

        {/* Time Range */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Time Frame</label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {TIME_RANGES.map((r) => {
              const isActive = selectedRange === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => handleRangeSelect(r.key)}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: isActive
                      ? "var(--accent-primary)"
                      : "var(--text-tertiary)",
                    background: isActive
                      ? "var(--accent-muted)"
                      : "transparent",
                    border: `1px solid ${
                      isActive
                        ? "rgba(124,124,255,0.27)"
                        : "var(--border-default)"
                    }`,
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: "pointer",
                    transition: "all 0.12s ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Exact date picker — only visible when "Exact" is selected */}
        {selectedRange === "exact" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={draft.projectedDate}
              onChange={(e) => handleChange("projectedDate", e.target.value)}
              style={{
                ...inputStyle,
                width: 140,
                color: "var(--text-primary)",
                colorScheme: "dark",
              }}
            />
          </div>
        )}

        {/* Done / Status */}
        {isReady ? (
          <button
            onClick={() => setEditing(false)}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--semantic-positive)",
              background: "var(--semantic-positive-muted)",
              border: "1px solid rgba(63,207,142,0.27)",
              borderRadius: 6,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            ✓ Done
          </button>
        ) : (
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              padding: "8px 0",
            }}
          >
            Fill required fields to see contracts
          </div>
        )}
      </div>
    </div>
  );
}
