"use client";

import { useEffect, useState } from "react";

interface MarketStatus {
  status: "open" | "pre-market" | "after-hours" | "closed";
  etTime: string;
}

const STATUS_CONFIG: Record<
  MarketStatus["status"],
  { label: string; color: string; dotColor: string }
> = {
  open: {
    label: "Market Open",
    color: "var(--semantic-positive)",
    dotColor: "var(--semantic-positive)",
  },
  "pre-market": {
    label: "Pre-Market",
    color: "var(--semantic-warning)",
    dotColor: "var(--semantic-warning)",
  },
  "after-hours": {
    label: "After Hours",
    color: "var(--semantic-warning)",
    dotColor: "var(--semantic-warning)",
  },
  closed: {
    label: "Market Closed",
    color: "var(--text-tertiary)",
    dotColor: "var(--text-tertiary)",
  },
};

export function PageHeader({ status }: { status?: string }) {
  const [market, setMarket] = useState<MarketStatus | null>(null);

  useEffect(() => {
    fetch("/api/market/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status) setMarket(d);
      })
      .catch(() => {});

    // Refresh every 60s
    const id = setInterval(() => {
      fetch("/api/market/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.status) setMarket(d);
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const cfg = market ? STATUS_CONFIG[market.status] : null;
  const isStale = market && market.status !== "open";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent-primary)",
              boxShadow: "0 0 8px rgba(124,124,255,0.4)",
            }}
          />
          <h1
            style={{
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Options Finder
          </h1>
        </div>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 12,
            color: "var(--text-tertiary)",
            margin: "6px 0 0 18px",
          }}
        >
          Forward-priced ROI with scenario analysis
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Market status */}
        {cfg && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              fontWeight: 500,
              color: cfg.color,
              background: "var(--bg-surface-hover)",
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: cfg.dotColor,
                flexShrink: 0,
                ...(market?.status === "open"
                  ? { boxShadow: `0 0 6px ${cfg.dotColor}` }
                  : {}),
              }}
            />
            {cfg.label}
            {isStale && (
              <span
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 9,
                  marginLeft: 2,
                }}
              >
                · prices may be stale
              </span>
            )}
          </div>
        )}

        {/* Loading status */}
        {status && (
          <div
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 10,
              color: "var(--text-tertiary)",
              background: "var(--bg-surface-hover)",
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
            }}
          >
            <span style={{ color: "var(--semantic-positive)" }}>●</span>
            {" " + status}
          </div>
        )}
      </div>
    </div>
  );
}
