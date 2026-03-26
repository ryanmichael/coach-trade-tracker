"use client";

import { useState } from "react";
import type { TradeInput, CustomTradeInput } from "@/lib/options";

interface TickerSelectorProps {
  selected: string | null;
  coachTickers: string[];
  coachTrades: Record<string, TradeInput>;
  customTickers: string[];
  customDrafts: Record<string, CustomTradeInput>;
  onSelect: (ticker: string) => void;
  onAddCustom: (ticker: string) => void;
  onRemoveCustom: (ticker: string) => void;
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
        <div
          style={{
            flex: 1,
            height: 1,
            background: "var(--border-default)",
          }}
        />
      </div>

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
              width: 80,
              textTransform: "uppercase",
            }}
          />
        </div>
      </div>
    </div>
  );
}
