"use client";

import { StatusDot } from "./StatusDot";
import type { DelistCheckResult } from "@/stores/delist-monitor";

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  sec_edgar: { label: "SEC", color: "var(--semantic-negative)" },
  polygon_volume: { label: "Volume", color: "var(--semantic-warning)" },
  polygon_aum: { label: "AUM", color: "var(--semantic-warning)" },
  web_search: { label: "Web", color: "var(--semantic-info)" },
  ai_analysis: { label: "AI", color: "var(--accent-primary)" },
};

interface DelistCheckHistoryProps {
  results: DelistCheckResult[];
}

export function DelistCheckHistory({ results }: DelistCheckHistoryProps) {
  if (results.length === 0) {
    return (
      <div style={{ padding: "8px 12px 4px 32px", fontSize: 12, color: "var(--text-tertiary)" }}>
        No check history yet
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0 4px 32px", display: "flex", flexDirection: "column", gap: 4 }}>
      {results.map((r) => {
        const source = SOURCE_LABELS[r.source] ?? { label: r.source, color: "var(--text-tertiary)" };
        const date = new Date(r.checkDate);
        const dateStr = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        return (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              fontSize: 12,
            }}
          >
            <StatusDot status={r.signalLevel} size={6} pulse={false} />

            {/* Source badge */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: source.color,
                padding: "1px 6px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--bg-elevated)",
                flexShrink: 0,
              }}
            >
              {source.label}
            </span>

            {/* Summary */}
            <span style={{ flex: 1, color: "var(--text-secondary)" }}>
              {r.summary}
            </span>

            {/* Link */}
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontSize: 11,
                  color: "var(--accent-primary)",
                  textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                View →
              </a>
            )}

            {/* Date */}
            <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
              {dateStr}
            </span>
          </div>
        );
      })}
    </div>
  );
}
