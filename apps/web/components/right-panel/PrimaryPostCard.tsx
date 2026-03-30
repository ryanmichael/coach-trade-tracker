"use client";

import { useState } from "react";
import { ConfidenceBadge } from "@/components/primitives/ConfidenceBadge";
import { ActionPanel } from "@/components/layout/ActionPanel";
import { ReportPanel } from "@/components/action-panels/ReportPanel";
import { TradeSummaryChart } from "@/components/charts/TradeSummaryChart";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { formatRelativeTime, type MockPost } from "@/lib/mock-data";
import type { ChartData } from "@/lib/agents/chart-visualization/types";

interface PrimaryPostCardProps {
  post: MockPost;
  currentPrice?: number;
  onUpdate?: () => void;
}

const ChartIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 15l4-4 3 3 4-4 7 7" />
  </svg>
);

const MessageIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export function PrimaryPostCard({ post, currentPrice = 0, onUpdate }: PrimaryPostCardProps) {
  const [showText, setShowText] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const { bars: priceHistory, isLoading: historyLoading } = usePriceHistory(post.ticker);

  // When real price bars are available but no parsed chartData, build a minimal
  // ChartData so TradeSummaryChart can still render level overlays.
  const chartData: ChartData | null =
    post.chartData ??
    (priceHistory
      ? {
          prices: [],
          projected: [],
          yMin: 0,
          yMax: 0,
          targetLow: null,
          targetHigh: null,
          confirmation: post.confirmationPrice || null,
          stopLoss: null,
          months: [],
          timeWindow: null,
          channelUpper: null,
          channelLower: null,
        }
      : null);

  const handleReportSubmit = (text: string) => {
    setReportOpen(false);
    setFeedbackSaved(true);
    setTimeout(() => setFeedbackSaved(false), 3000);

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachPostId: post.id,
        parsedTradeId: post.parsedTradeId ?? null,
        feedbackText: text,
      }),
    }).catch((err) => console.error("[Report] Feedback submit failed:", err));
  };

  return (
    <>
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-brand-md)",
          overflow: "hidden",
          transition: "border-color var(--duration-fast) var(--ease-default)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-strong)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-default)";
        }}
      >
        {/* Chart — real Polygon data when available, then schematic, then placeholder */}
        {chartData ? (
          <div
            style={{
              width: "100%",
              padding: "16px 20px 8px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <TradeSummaryChart
              data={chartData}
              direction={post.direction}
              currentPrice={currentPrice}
              priceHistory={priceHistory ?? undefined}
            />
          </div>
        ) : historyLoading ? (
          /* Shimmer while fetching price history */
          <div
            style={{
              width: "100%",
              height: 180,
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border-subtle)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)",
                animation: "shimmerSweep 1.6s ease-in-out infinite",
              }}
            />
            <style>{`@keyframes shimmerSweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }`}</style>
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              height: 180,
              background: "var(--bg-elevated)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-tertiary)",
              fontSize: 13,
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <ChartIcon />
            <span style={{ marginLeft: 8 }}>Technical chart from X post</span>
          </div>
        )}

        <div style={{ padding: "16px 20px 0" }}>
          {/* Header: Latest + timestamp + Show/Update */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--accent-primary)",
                }}
              >
                Latest
              </span>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {formatRelativeTime(post.postedAt)}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setShowText(!showText)}
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
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
              >
                <MessageIcon />
                {showText ? "Hide" : "Show"}
              </button>

              <div
                style={{
                  width: 1,
                  height: 16,
                  background: "var(--border-default)",
                  margin: "0 4px",
                }}
              />

              <button
                title="Paste a new Coach post for this ticker"
                onClick={onUpdate}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: "var(--radius-brand-sm)",
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all var(--duration-fast) var(--ease-default)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.borderColor = "var(--accent-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.borderColor = "var(--border-strong)";
                }}
              >
                <PlusIcon />
                Update
              </button>
            </div>
          </div>

          {/* Metrics: Target | Date | Confidence */}
          <div
            style={{
              display: "flex",
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: 12,
              paddingBottom: 16,
            }}
          >
            {/* Target */}
            <div
              style={{
                flex: 1,
                paddingRight: 16,
                borderRight: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--text-tertiary)",
                  marginBottom: 4,
                }}
              >
                Target
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono), 'DM Mono', monospace",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {post.priceTarget}
                <span
                  style={{
                    color:
                      post.targetPercent.startsWith("-")
                        ? "var(--semantic-negative)"
                        : "var(--semantic-positive)",
                    fontSize: 12,
                  }}
                >
                  ({post.targetPercent})
                </span>
              </div>
            </div>

            {/* Date */}
            <div
              style={{
                flex: 1,
                paddingLeft: 16,
                paddingRight: 16,
                borderRight: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--text-tertiary)",
                  marginBottom: 4,
                }}
              >
                Date
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono), 'DM Mono', monospace",
                  fontSize: 14,
                  color: "var(--text-primary)",
                }}
              >
                {post.projectedDate}
              </div>
            </div>

            {/* Confidence */}
            <div style={{ flex: 1, paddingLeft: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--text-tertiary)",
                  marginBottom: 4,
                }}
              >
                Confidence
              </div>
              <ConfidenceBadge value={post.confidence} />
            </div>
          </div>

          {/* Report footer — inside card, separated by a subtle divider */}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              padding: "5px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
            }}
          >
            {feedbackSaved ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "var(--semantic-positive)",
                }}
              >
                <CheckIcon />
                Feedback saved
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Analysis not right?{" "}
                <button
                  onClick={() => setReportOpen(true)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--accent-primary)",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontSize: 12,
                    fontWeight: 500,
                    transition: "color var(--duration-fast) var(--ease-default)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--accent-primary-hover)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--accent-primary)")
                  }
                >
                  Report
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Expanded post text */}
        {showText && (
          <div
            style={{
              padding: "12px 20px 16px",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
              background: "var(--bg-base)",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            {post.content}
          </div>
        )}
      </div>

      {/* Report action panel */}
      <ActionPanel
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report Issue"
        description="Help improve how the system interprets Coach's posts"
      >
        <ReportPanel
          onSubmit={handleReportSubmit}
          onCancel={() => setReportOpen(false)}
        />
      </ActionPanel>
    </>
  );
}
