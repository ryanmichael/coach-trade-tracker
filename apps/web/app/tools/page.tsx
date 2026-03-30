"use client";

import { useState } from "react";
import Link from "next/link";
import { DelistMonitor } from "@/components/tools/DelistMonitor";
import { OptionsFinder } from "@/components/options-finder/OptionsFinder";

const TABS = [
  { key: "options", label: "Options Finder" },
  { key: "delist", label: "Delist Monitor" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("options");

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Top nav bar */}
      <div
        style={{
          height: 52,
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
          flexShrink: 0,
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-tertiary)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
            transition: "color 120ms ease",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-tertiary)")}
        >
          ← Dashboard
        </Link>
        <div style={{ width: 1, height: 16, background: "var(--border-default)" }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
          Tools
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-default)",
          flexShrink: 0,
          backgroundColor: "var(--bg-surface)",
          paddingLeft: 24,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 16px",
              fontSize: 12,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.key
                ? "2px solid var(--accent-primary)"
                : "2px solid transparent",
              color: activeTab === tab.key
                ? "var(--accent-primary)"
                : "var(--text-tertiary)",
              cursor: "pointer",
              transition: "color var(--duration-fast) var(--ease-default)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "delist" && <DelistMonitor />}
        {activeTab === "options" && <OptionsFinder />}
      </div>
    </div>
  );
}
