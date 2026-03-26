"use client";

import { useEffect } from "react";
import { useDelistMonitorStore } from "@/stores/delist-monitor";
import { DelistTickerInput } from "./DelistTickerInput";
import { DelistTickerRow } from "./DelistTickerRow";
import { StatusDot } from "./StatusDot";

export function DelistMonitor() {
  const {
    tickers,
    isLoading,
    isChecking,
    lastCheckedAt,
    fetch: fetchTickers,
    addTickers,
    removeTicker,
    runCheck,
    fetchHistory,
  } = useDelistMonitorStore();

  useEffect(() => {
    fetchTickers();
  }, [fetchTickers]);

  const yellowCount = tickers.filter((t) => t.status === "yellow").length;
  const redCount = tickers.filter((t) => t.status === "red").length;

  const lastCheckedStr = lastCheckedAt
    ? formatRelativeTime(new Date(lastCheckedAt))
    : null;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "24px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Header */}
      <div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "var(--text-primary)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Delist Monitor
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            margin: "4px 0 0",
          }}
        >
          Track ETFs for delisting or liquidation risk. Checks SEC filings, volume trends, and news.
        </p>
      </div>

      {/* Add tickers input */}
      <DelistTickerInput onAdd={addTickers} disabled={isChecking} />

      {/* Status summary + check button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {tickers.length > 0 && (
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {tickers.length} ticker{tickers.length !== 1 ? "s" : ""} monitored
            </span>
          )}
          {redCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <StatusDot status="red" size={6} />
              <span style={{ color: "var(--semantic-negative)" }}>{redCount} red</span>
            </span>
          )}
          {yellowCount > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
              <StatusDot status="yellow" size={6} pulse={false} />
              <span style={{ color: "var(--semantic-warning)" }}>{yellowCount} yellow</span>
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastCheckedStr && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              Last checked {lastCheckedStr}
            </span>
          )}
          <button
            onClick={runCheck}
            disabled={isChecking || tickers.length === 0}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 500,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              backgroundColor: "transparent",
              color: isChecking ? "var(--text-tertiary)" : "var(--text-primary)",
              border: `1px solid ${isChecking ? "var(--border-subtle)" : "var(--border-strong)"}`,
              borderRadius: "var(--radius-md)",
              cursor: isChecking || tickers.length === 0 ? "not-allowed" : "pointer",
              opacity: tickers.length === 0 ? 0.5 : 1,
              transition: "all var(--duration-fast) var(--ease-default)",
            }}
            onMouseEnter={(e) => {
              if (!isChecking && tickers.length > 0) {
                e.currentTarget.style.backgroundColor = "var(--bg-surface-hover)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {isChecking ? "Checking…" : "Run Check"}
          </button>
        </div>
      </div>

      {/* Ticker list */}
      {isLoading ? (
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "20px 0" }}>
          Loading…
        </div>
      ) : tickers.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            borderRadius: "var(--radius-md)",
            border: "1px dashed var(--border-default)",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
            No tickers being monitored
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
            Add ETF tickers above to start monitoring for delist risk
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Sort: red first, then yellow, then green */}
          {[...tickers]
            .sort((a, b) => {
              const priority = { red: 0, yellow: 1, green: 2 };
              return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
            })
            .map((ticker) => (
              <DelistTickerRow
                key={ticker.id}
                ticker={ticker}
                onRemove={removeTicker}
                onFetchHistory={fetchHistory}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
