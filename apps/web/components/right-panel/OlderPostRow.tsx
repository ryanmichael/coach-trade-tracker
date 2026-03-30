"use client";

import { useState } from "react";
import { formatRelativeTime, type MockPost } from "@/lib/mock-data";
import { TradeSummaryChart } from "@/components/charts/TradeSummaryChart";

interface OlderPostRowProps {
  post: MockPost;
  currentPrice?: number;
  onDelete?: () => void;
}

const ClockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--text-tertiary)"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

export function OlderPostRow({ post, currentPrice = 0, onDelete }: OlderPostRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-brand-md)",
        overflow: "hidden",
        transition: "border-color var(--duration-fast) var(--ease-default)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-default)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle)";
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
        }}
      >
        {/* Clock + timestamp */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ClockIcon />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {formatRelativeTime(post.postedAt)}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: "var(--radius-brand-sm)",
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "color var(--duration-fast) var(--ease-default)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            {expanded ? "Hide" : "View"}
          </button>

          <button
            onClick={onDelete}
            title="Delete post"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              borderRadius: "var(--radius-brand-sm)",
              transition: "color var(--duration-fast) var(--ease-default)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--semantic-negative)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
          {/* Chart — if available */}
          {post.chartData && (
            <div
              style={{
                padding: "12px 14px 8px",
                borderBottom: post.content ? "1px solid var(--border-subtle)" : undefined,
              }}
            >
              <TradeSummaryChart
                data={post.chartData}
                direction={post.direction}
                currentPrice={currentPrice}
              />
            </div>
          )}

          {/* Post text */}
          {post.content && (
            <div
              style={{
                padding: "10px 14px 12px",
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--text-secondary)",
              }}
            >
              {post.content}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
