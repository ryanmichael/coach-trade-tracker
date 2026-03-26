"use client";

import { useAlertsStore, ALERT_META } from "@/stores/alerts";

interface InlineAlertProps {
  ticker: string;
}

export function InlineAlert({ ticker }: InlineAlertProps) {
  const { tickerAlerts, dismissTickerAlert } = useAlertsStore();
  const alert = tickerAlerts[ticker];

  if (!alert?.active) return null;

  const meta = ALERT_META[alert.type];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: "var(--radius-brand-md)",
        border: `1px solid ${meta.color}`,
        background: meta.bg,
        animation: "alertFadeIn var(--duration-normal) var(--ease-default)",
      }}
    >
      <style>{`
        @keyframes alertFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "var(--radius-brand-sm)",
          background: "rgba(0,0,0,0.15)",
          color: meta.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {meta.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: meta.color,
            marginBottom: 2,
          }}
        >
          {meta.label}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.4 }}>
          {alert.message}
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => dismissTickerAlert(ticker)}
        style={{
          padding: "5px 12px",
          borderRadius: "var(--radius-brand-sm)",
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(0,0,0,0.15)",
          color: "var(--text-primary)",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          flexShrink: 0,
          transition: "background var(--duration-fast) var(--ease-default)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.3)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(0,0,0,0.15)";
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
