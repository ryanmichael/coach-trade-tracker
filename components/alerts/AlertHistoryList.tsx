"use client";

import { useAlertsStore, ALERT_META } from "@/stores/alerts";
import { formatRelativeTime } from "@/lib/mock-data";

export function AlertHistoryList() {
  const { history, clearHistory } = useAlertsStore();

  if (history.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
          gap: 8,
          color: "var(--text-tertiary)",
          fontSize: 13,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        <div>No notifications yet</div>
        <div style={{ fontSize: 12 }}>
          Alerts will appear here when confirmation prices are reached.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {history.map((alert, i) => {
        const meta = ALERT_META[alert.type];
        return (
          <div
            key={alert.id}
            style={{
              display: "flex",
              gap: 12,
              padding: "12px 0",
              borderBottom:
                i < history.length - 1
                  ? "1px solid var(--border-subtle)"
                  : "none",
              opacity: alert.read ? 0.6 : 1,
            }}
          >
            {/* Unread dot */}
            <div
              style={{
                flexShrink: 0,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: alert.read ? "transparent" : meta.color,
                marginTop: 5,
              }}
            />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: meta.color,
                  }}
                >
                  {alert.ticker}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.02em",
                  }}
                >
                  · {meta.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--text-primary)",
                  lineHeight: 1.4,
                  marginBottom: 4,
                }}
              >
                {alert.message}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {formatRelativeTime(new Date(alert.createdAt).toISOString())}
              </div>
            </div>
          </div>
        );
      })}

      {/* Clear all footer */}
      <div style={{ paddingTop: 16 }}>
        <button
          onClick={clearHistory}
          style={{
            background: "none",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-brand-sm)",
            color: "var(--text-tertiary)",
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 14px",
            cursor: "pointer",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            transition: "color var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)",
            width: "100%",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--semantic-negative)";
            e.currentTarget.style.borderColor = "var(--semantic-negative)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-tertiary)";
            e.currentTarget.style.borderColor = "var(--border-default)";
          }}
        >
          Clear all notifications
        </button>
      </div>
    </div>
  );
}
