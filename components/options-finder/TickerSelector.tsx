"use client";

import { useEffect, useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import type { TradeInput, CustomTradeInput, RiskTolerance } from "@/lib/options";
import { formatMoney, formatDate, daysUntil } from "@/lib/options";

const RISK_LEVELS: { key: RiskTolerance; label: string; color: string }[] = [
  { key: "high", label: "Hi", color: "var(--semantic-negative)" },
  { key: "medium", label: "Md", color: "var(--semantic-warning)" },
  { key: "low", label: "Lw", color: "var(--semantic-positive)" },
];

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

interface TickerSelectorProps {
  selected: string | null;
  coachTickers: string[];
  coachTrades: Record<string, TradeInput>;
  customTickers: string[];
  customDrafts: Record<string, CustomTradeInput>;
  onSelect: (ticker: string) => void;
  onAddCustom: (ticker: string) => void;
  onRemoveCustom: (ticker: string) => void;
  // Trade context props
  currentTrade?: TradeInput | CustomTradeInput | null;
  isCoachRec?: boolean;
  onUpdateDraft?: (draft: CustomTradeInput) => void;
  onRiskChange?: (ticker: string, risk: RiskTolerance) => void;
}

export function TickerSelector({
  selected,
  coachTickers,
  coachTrades,
  customTickers,
  customDrafts,
  onSelect,
  onAddCustom,
  onRemoveCustom,
  currentTrade,
  isCoachRec,
  onUpdateDraft,
  onRiskChange,
}: TickerSelectorProps) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && inputValue.trim().length > 0) {
      onAddCustom(inputValue.trim().toUpperCase());
      setInputValue("");
    }
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 20,
      }}
    >
      {/* Section label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Select Ticker
        </span>
      </div>

      {/* Ticker pills row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {/* Coach rec label */}
        {coachTickers.length > 0 && (
          <span
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginRight: 2,
            }}
          >
            Coach recs
          </span>
        )}

        {/* Coach rec chips */}
        {coachTickers.map((ticker) => {
          const isActive = selected === ticker;
          const trade = coachTrades[ticker];
          const dirColor =
            trade?.direction === "LONG"
              ? "var(--semantic-positive)"
              : "var(--semantic-negative)";

          return (
            <button
              key={ticker}
              onClick={() => onSelect(ticker)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                background: isActive
                  ? "var(--accent-muted)"
                  : "transparent",
                border: `1px solid ${
                  isActive
                    ? "rgba(124,124,255,0.33)"
                    : "var(--border-default)"
                }`,
                borderRadius: 8,
                padding: "7px 14px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {ticker}
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  color: dirColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  opacity: 0.8,
                }}
              >
                {trade?.direction === "LONG" ? "▲" : "▼"}
              </span>
            </button>
          );
        })}

        {/* Custom ticker chips */}
        {customTickers.map((ticker) => {
          const isActive = selected === ticker;
          const draft = customDrafts[ticker];
          const isReady =
            draft &&
            draft.currentPrice > 0 &&
            draft.priceTargetHigh > 0 &&
            draft.projectedDate.length > 0;
          const dir =
            draft && draft.currentPrice > 0 && draft.priceTargetHigh > 0
              ? draft.priceTargetHigh >= draft.currentPrice
                ? "LONG"
                : "SHORT"
              : null;
          const dirColor =
            dir === "LONG"
              ? "var(--semantic-positive)"
              : dir === "SHORT"
                ? "var(--semantic-negative)"
                : undefined;

          return (
            <div
              key={ticker}
              style={{ position: "relative", display: "inline-flex" }}
            >
              <button
                onClick={() => onSelect(ticker)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                  background: isActive
                    ? "var(--accent-muted)"
                    : "transparent",
                  border: `1px solid ${
                    isActive
                      ? "rgba(124,124,255,0.33)"
                      : "var(--border-default)"
                  }`,
                  borderRadius: 8,
                  padding: "7px 28px 7px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {ticker}
                {dir && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      color: dirColor,
                      opacity: 0.8,
                    }}
                  >
                    {dir === "LONG" ? "▲" : "▼"}
                  </span>
                )}
                {!isReady && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--semantic-warning)",
                      opacity: 0.6,
                      flexShrink: 0,
                    }}
                    title="Needs trade details"
                  />
                )}
              </button>
              <button
                onClick={() => onRemoveCustom(ticker)}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 2px",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          );
        })}

        {/* Divider */}
        {(coachTickers.length > 0 || customTickers.length > 0) && (
          <div
            style={{
              width: 1,
              height: 24,
              background: "var(--border-strong)",
              marginLeft: 4,
              marginRight: 4,
            }}
          />
        )}

        {/* Add custom ticker input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            background: "var(--bg-surface-hover)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              padding: "0 0 0 10px",
            }}
          >
            +
          </span>
          <input
            type="text"
            placeholder="Add ticker"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={5}
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 12,
              color: "var(--text-primary)",
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "7px 10px 7px 6px",
              width: 100,
              textTransform: "uppercase",
            }}
          />
        </div>
      </div>

      {/* Expanded trade context — shown when a ticker is selected */}
      {currentTrade && selected && (
        <TradeContext
          key={selected}
          trade={currentTrade}
          editable={!isCoachRec}
          onUpdate={onUpdateDraft}
          onRiskChange={onRiskChange}
        />
      )}
    </div>
  );
}

// ── Inline trade context (replaces TradeContextBar) ──────────────────────────

function TradeContext({
  trade,
  editable,
  onUpdate,
  onRiskChange,
}: {
  trade: TradeInput | CustomTradeInput;
  editable?: boolean;
  onUpdate?: (draft: CustomTradeInput) => void;
  onRiskChange?: (ticker: string, risk: RiskTolerance) => void;
}) {
  const isReady =
    trade.currentPrice > 0 &&
    trade.priceTargetHigh > 0 &&
    trade.projectedDate.length > 0;

  const [editing, setEditing] = useState(editable && !isReady);

  // Force edit mode open when custom ticker isn't ready (e.g. newly added)
  const shouldForceEdit = editable && !isReady && !editing;
  useEffect(() => {
    if (shouldForceEdit) setEditing(true);
  }, [shouldForceEdit]);

  // Buffer edits locally so the options chain doesn't re-fetch on every keystroke.
  // Only flush to the store when the user clicks "Done".
  const [draft, setDraft] = useState<CustomTradeInput>(trade as CustomTradeInput);
  useEffect(() => {
    if (!editing) setDraft(trade as CustomTradeInput);
  }, [editing, trade]);

  // Sync store price into draft when it arrives from async fetch (e.g. newly added ticker)
  useEffect(() => {
    if (editing && trade.currentPrice > 0 && draft.currentPrice === 0) {
      setDraft((d) => ({ ...d, currentPrice: trade.currentPrice }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade.currentPrice]);

  const [selectedRange, setSelectedRange] = useState<RangeKey | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // Use draft values when editing, store values when in read mode
  const display = editing ? draft : trade;

  const dirColor =
    display.direction === "LONG"
      ? "var(--semantic-positive)"
      : "var(--semantic-negative)";
  const dirBg =
    display.direction === "LONG"
      ? "var(--semantic-positive-muted)"
      : "var(--semantic-negative-muted)";

  function handleChange(field: keyof CustomTradeInput, value: string | number) {
    const updated = { ...draft, [field]: value };
    if (updated.currentPrice > 0 && updated.priceTargetHigh > 0) {
      updated.direction =
        updated.priceTargetHigh >= updated.currentPrice ? "LONG" : "SHORT";
    }
    setDraft(updated);
  }

  function handleDone() {
    if (onUpdate) onUpdate(draft);
    setEditing(false);
  }

  function handleRangeSelect(range: RangeKey) {
    setSelectedRange(range);
    if (range !== "exact") {
      const r = TIME_RANGES.find((t) => t.key === range)!;
      handleChange("projectedDate", addDays(r.days));
    } else if (!draft.projectedDate) {
      handleChange("projectedDate", "");
    }
  }

  async function handleRefreshPrice() {
    if (!draft.ticker || fetchingPrice) return;
    setFetchingPrice(true);
    try {
      const res = await fetch(`/api/prices/${encodeURIComponent(draft.ticker)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.price) handleChange("currentPrice", data.price);
      }
    } catch {
      // silently fail
    } finally {
      setFetchingPrice(false);
    }
  }

  const daysLeft = display.projectedDate ? daysUntil(display.projectedDate) : 0;
  const dateLabel =
    rangeLabelFromDate(display.projectedDate) ?? formatDate(display.projectedDate);

  const draftReady =
    draft.currentPrice > 0 &&
    draft.priceTargetHigh > 0 &&
    draft.projectedDate.length > 0;

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

  // ── Edit mode ─────────────────────────────────────────────────────────────
  if (editable && editing) {
    return (
      <div
        style={{
          borderTop: "1px solid var(--border-default)",
          marginTop: 16,
          paddingTop: 16,
        }}
      >
        {/* Header */}
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
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {draft.ticker}
          </span>
          {draft.currentPrice > 0 && draft.priceTargetHigh > 0 && (
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
              {draft.direction === "LONG" ? "▲ Long" : "▼ Short"}
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
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Target Price</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={draft.priceTargetHigh > 0 ? draft.priceTargetHigh : ""}
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
                value={draft.projectedDate}
                onChange={(e) => handleChange("projectedDate", e.target.value)}
                style={{ ...inputStyle, width: 140, colorScheme: "dark" }}
              />
            </div>
          )}

          {draftReady && (
            <button
              onClick={handleDone}
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
          {!draftReady && (
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", padding: "8px 0" }}>
              Fill fields to see contracts
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Read mode ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        borderTop: "1px solid var(--border-default)",
        marginTop: 16,
        paddingTop: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      {/* Left: ticker + direction + coach badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: 20,
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

      {/* Right: metrics + edit */}
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

        {/* Risk toggle — always available (coach recs + custom) */}
        {onRiskChange && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Risk
            </span>
            <div style={{ display: "flex", gap: 2 }}>
              {RISK_LEVELS.map((r) => {
                const isActive = (trade.riskTolerance ?? "medium") === r.key;
                return (
                  <button
                    key={r.key}
                    onClick={() => {
                      onRiskChange(trade.ticker, r.key);
                      if (onUpdate) {
                        // Update store directly (read mode — no buffering)
                        onUpdate({ ...(trade as CustomTradeInput), riskTolerance: r.key });
                      }
                    }}
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: isActive ? r.color : "var(--text-tertiary)",
                      background: isActive
                        ? `color-mix(in srgb, ${r.color} 12%, transparent)`
                        : "transparent",
                      border: `1px solid ${
                        isActive
                          ? `color-mix(in srgb, ${r.color} 27%, transparent)`
                          : "var(--border-default)"
                      }`,
                      borderRadius: 5,
                      padding: "4px 7px",
                      cursor: "pointer",
                      transition: "all 0.12s ease",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

      {trade.coachNote && (
        <div
          style={{
            width: "100%",
            marginTop: 4,
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
  inline,
  accent,
  negative,
}: {
  label: string;
  value: string;
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
    </div>
  );
}
