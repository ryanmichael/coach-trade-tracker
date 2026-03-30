"use client";

import Link from "next/link";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { useDelistSummary } from "@/hooks/useDelistSummary";
import { useAlertsStore } from "@/stores/alerts";
import type { MarketStatus } from "@/lib/polygon";

const MARKET_STATUS_CONFIG: Record<
  MarketStatus,
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
    color: "var(--semantic-info)",
    dotColor: "var(--semantic-info)",
  },
  closed: {
    label: "Market Closed",
    color: "var(--text-tertiary)",
    dotColor: "var(--text-tertiary)",
  },
};

interface LogoHeaderProps {
  onBellClick: () => void;
}

export function LogoHeader({ onBellClick }: LogoHeaderProps) {
  const { status } = useMarketStatus();
  const statusConfig = MARKET_STATUS_CONFIG[status];
  const unreadCount = useAlertsStore(
    (s) => s.history.filter((h) => !h.read).length
  );
  const { yellowCount: delistYellow, redCount: delistRed } = useDelistSummary();
  const hasDelistAlert = delistRed > 0 || delistYellow > 0;
  const delistDotColor = delistRed > 0 ? "var(--semantic-negative)" : "var(--semantic-warning)";
  return (
    <div
      style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid var(--border-default)",
        flexShrink: 0,
      }}
    >
      {/* Row 1: logo + X link */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {/* Logo mark + app name */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Radar-inspired mark */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--accent-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            {/* Concentric arcs radiating from bottom-left */}
            <circle
              cx="4"
              cy="18"
              r="6"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1.5"
              fill="none"
            />
            <circle
              cx="4"
              cy="18"
              r="11"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1.5"
              fill="none"
            />
            <circle
              cx="4"
              cy="18"
              r="16"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="1.5"
              fill="none"
            />
            {/* Diagonal sweep line */}
            <line
              x1="4"
              y1="18"
              x2="18"
              y2="4"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Blip dot */}
            <circle cx="13" cy="9" r="2" fill="#fff" opacity="0.9" />
          </svg>
        </div>

        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}
        >
          Coachtrack
        </span>
      </div>

      {/* Right icons: intelligence + bell + X feed */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

      {/* Coach Intelligence link */}
      <Link
        href="/coach"
        title="Coach Intelligence"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 6,
          color: "#3A3A42",
          textDecoration: "none",
          transition: "color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = "#63636E";
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = "#3A3A42";
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
        }}
      >
        {/* Brain / intelligence icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66Z" />
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66Z" />
        </svg>
      </Link>

      {/* Tools link */}
      <Link
        href="/tools"
        title="Tools"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 6,
          color: hasDelistAlert ? delistDotColor : "#3A3A42",
          textDecoration: "none",
          transition: "color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = hasDelistAlert ? delistDotColor : "#63636E";
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.color = hasDelistAlert ? delistDotColor : "#3A3A42";
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
        }}
      >
        {/* Wrench icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        {hasDelistAlert && (
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: delistDotColor,
              border: "1.5px solid var(--bg-base)",
              fontSize: 0,
            }}
          />
        )}
      </Link>

      {/* Bell icon */}
      <button
        onClick={onBellClick}
        title="Notifications"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 6,
          background: "none",
          border: "none",
          color: unreadCount > 0 ? "var(--accent-primary)" : "#3A3A42",
          cursor: "pointer",
          transition: "color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = unreadCount > 0 ? "var(--accent-primary-hover)" : "#63636E";
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = unreadCount > 0 ? "var(--accent-primary)" : "#3A3A42";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent-primary)",
              border: "1.5px solid var(--bg-base)",
              fontSize: 0,
            }}
          />
        )}
      </button>

      {/* X feed link */}
      <a
        href="https://x.com/great_martis/superfollows"
        target="_blank"
        rel="noopener noreferrer"
        title="Open Coach's X feed"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          borderRadius: 6,
          color: "#3A3A42",
          textDecoration: "none",
          transition: "color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#63636E";
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#3A3A42";
          e.currentTarget.style.background = "transparent";
        }}
      >
        {/* X (Twitter) icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      </div>{/* end right icons */}
      </div>

      {/* Row 2: market status indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginTop: 8,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: statusConfig.dotColor,
            flexShrink: 0,
            // Pulse animation for "open" state only
            animation: status === "open" ? "statusPulse 2.5s ease-in-out infinite" : "none",
          }}
        />
        <style>{`
          @keyframes statusPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: statusConfig.color,
            letterSpacing: "0.02em",
          }}
        >
          {statusConfig.label}
        </span>
      </div>
    </div>
  );
}
