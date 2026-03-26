"use client";

import { useState } from "react";
import { StatusDot } from "./StatusDot";
import { DelistCheckHistory } from "./DelistCheckHistory";
import type { DelistTicker, DelistCheckResult } from "@/stores/delist-monitor";

interface DelistTickerRowProps {
  ticker: DelistTicker;
  onRemove: (id: string) => void;
  onFetchHistory: (id: string) => Promise<DelistCheckResult[]>;
}

export function DelistTickerRow({ ticker, onRemove, onFetchHistory }: DelistTickerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<DelistCheckResult[] | null>(null);
  const [hovered, setHovered] = useState(false);

  async function toggleExpand() {
    if (!expanded && !history) {
      const data = await onFetchHistory(ticker.id);
      setHistory(data);
    }
    setExpanded(!expanded);
  }

  const hasSignal = ticker.status !== "green";
  const latestCheck = ticker.checkResults?.[0];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${hovered ? "var(--border-default)" : "var(--border-subtle)"}`,
          backgroundColor: hovered ? "var(--bg-surface-hover)" : "var(--bg-surface)",
          transition: "all var(--duration-fast) var(--ease-default)",
          cursor: hasSignal ? "pointer" : "default",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={hasSignal ? toggleExpand : undefined}
      >
        {/* Status dot */}
        <StatusDot status={ticker.status} />

        {/* Ticker symbol */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "var(--text-primary)",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            minWidth: 56,
          }}
        >
          {ticker.ticker}
        </span>

        {/* Latest check summary */}
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {latestCheck?.summary ?? "No checks run yet"}
        </span>

        {/* Expand chevron for yellow/red */}
        {hasSignal && (
          <span
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform var(--duration-fast) var(--ease-default)",
            }}
          >
            ›
          </span>
        )}

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(ticker.id);
          }}
          title={`Remove ${ticker.ticker}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 4,
            border: "none",
            background: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: 14,
            transition: "color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--semantic-negative)";
            e.currentTarget.style.background = "var(--semantic-negative-muted)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-tertiary)";
            e.currentTarget.style.background = "none";
          }}
        >
          ✕
        </button>
      </div>

      {/* Expanded history */}
      {expanded && (
        <DelistCheckHistory
          results={history ?? ticker.checkResults ?? []}
        />
      )}
    </div>
  );
}
