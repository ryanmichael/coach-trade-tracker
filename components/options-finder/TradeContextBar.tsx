"use client";

import { useState } from "react";
import type { TradeInput, CustomTradeInput } from "@/lib/options";
import { formatMoney, formatDate, daysUntil } from "@/lib/options";

const TIME_RANGES = [
  { key: "1w", label: "1W", days: 7 },
  { key: "2w", label: "2W", days: 14 },
  { key: "3w", label: "3W", days: 21 },
  { key: "1m", label: "1M", days: 30 },
  { key: "2m", label: "2M", days: 60 },
  { key: "3m", label: "3M", days: 90 },
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
  for (const r of TIME_RANGES) {
    if (r.key !== "exact" && Math.abs(r.days - diffDays) <= 2) return `~${r.label}`;
  }
  return null;
}

interface TradeContextBarProps {
  trade: TradeInput | CustomTradeInput;
  editable?: boolean;
  onUpdate?: (draft: CustomTradeInput) => void;
}

export function TradeContextBar({
  trade,
  editable = false,
  onUpdate,
}: TradeContextBarProps) {
  const isReady =
    trade.currentPrice > 0 &&
    trade.priceTargetHigh > 0 &&
    trade.projectedDate.length > 0;

  // Custom tickers start in edit mode if not ready, otherwise read mode
  const [editing, setEditing] = useState(editable && !isReady);
  const [selectedRange, setSelectedRange] = useState<RangeKey | null>(null);

  const dirColor =
    trade.direction === "LONG"
      ? "var(--semantic-positive)"
      : "var(--semantic-negative)";
  const dirBg =
    trade.direction === "LONG"
      ? "var(--semantic-positive-muted)"
      : "var(--semantic-negative-muted)";

  function handleChange(field: keyof CustomTradeInput, value: string | number) {
    if (!onUpdate) return;
    const updated = { ...(trade as CustomTradeInput), [field]: value };
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
    } else if (!trade.projectedDate) {
      handleChange("projectedDate", "");
    }
  }

  const daysLeft = trade.projectedDate ? daysUntil(trade.projectedDate) : 0;
  const dateLabel =
    rangeLabelFromDate(trade.projectedDate) ?? formatDate(trade.projectedDate);

  // ── Edit mode ───────────────────────────────────────────────────────────────
  if (editable && editing) {
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
      color: "var(--text-primary)",
    };

    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px dashed rgba(124,124,255,0.20)",
          borderRadius: 12,
          padding: "18px 24px",
          marginBottom: 20,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
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
            {trade.ticker}
          </span>
          {trade.currentPrice > 0 && trade.priceTargetHigh > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: dirColor,
                background: dirBg,
                padding: "3px 8px",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {trade.direction === "LONG" ? "▲ Long" : "▼ Short"}
            </span>
          )}
        </div>

        {/* Fields row */}
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Current Price</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={trade.currentPrice > 0 ? trade.currentPrice : ""}
              onChange={(e) =>
                handleChange("currentPrice", parseFloat(e.target.value) || 0)
              }
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Target Price</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={trade.priceTargetHigh > 0 ? trade.priceTargetHigh : ""}
              onChange={(e) =>
                handleChange("priceTargetHigh", parseFloat(e.target.value) || 0)
              }
              style={{ ...inputStyle, color: "var(--accent-primary)" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Time Frame</label>
            <div style={{ display: "flex", gap: 3 }}>
              {TIME_RANGES.map((r) => {
                const isActive = selectedRange === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => handleRangeSelect(r.key)}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: isActive ? "var(--accent-primary)" : "var(--text-tertiary)",
                      background: isActive ? "var(--accent-muted)" : "transparent",
                      border: `1px solid ${isActive ? "rgba(124,124,255,0.27)" : "var(--border-default)"}`,
                      borderRadius: 6,
                      padding: "6px 8px",
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

          {selectedRange === "exact" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                value={trade.projectedDate}
                onChange={(e) => handleChange("projectedDate", e.target.value)}
                style={{ ...inputStyle, width: 140, colorScheme: "dark" }}
              />
            </div>
          )}

          {isReady && (
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
              Done
            </button>
          )}
          {!isReady && (
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "8px 0" }}>
              Fill fields to see contracts
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Read mode ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: "16px 24px",
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {/* Left: ticker + direction + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            {trade.ticker}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: dirColor,
              background: dirBg,
              padding: "4px 10px",
              borderRadius: 6,
              textTransform: "uppercase",
            }}
          >
            {trade.direction}
          </span>
          {trade.hasCoachRec && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.06em",
                color: "var(--accent-primary)",
                background: "var(--accent-muted)",
                padding: "3px 8px",
                borderRadius: 4,
                textTransform: "uppercase",
              }}
            >
              Coach Rec
            </span>
          )}
        </div>

        {/* Right: metrics + edit button */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <Metric label="Current" value={formatMoney(trade.currentPrice)} />
          <Metric label="Target" value={formatMoney(trade.priceTargetHigh)} accent />
          {trade.stopLoss > 0 && (
            <Metric label="Stop" value={formatMoney(trade.stopLoss)} negative />
          )}
          <Metric
            label="Projected"
            value={dateLabel}
            inline={daysLeft > 0 ? `(${daysLeft}D)` : undefined}
          />

          {editable && (
            <button
              onClick={() => setEditing(true)}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--accent-primary)",
                background: "transparent",
                border: "1px solid rgba(124,124,255,0.20)",
                borderRadius: 6,
                padding: "5px 12px",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {trade.coachNote && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            background: "var(--bg-surface-hover)",
            borderRadius: 8,
            borderLeft: `3px solid ${trade.hasCoachRec ? "var(--accent-primary)" : "var(--border-strong)"}`,
          }}
        >
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {trade.coachNote}
          </span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  inline,
  accent,
  negative,
}: {
  label: string;
  value: string;
  sub?: string;
  inline?: string;
  accent?: boolean;
  negative?: boolean;
}) {
  let color = "var(--text-primary)";
  if (accent) color = "var(--accent-primary)";
  if (negative) color = "var(--semantic-negative)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: 14,
          fontWeight: 500,
          color,
        }}
      >
        {value}
        {inline && (
          <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-tertiary)", marginLeft: 4 }}>
            {inline}
          </span>
        )}
      </span>
      {sub && (
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{sub}</span>
      )}
    </div>
  );
}
