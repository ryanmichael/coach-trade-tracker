"use client";

import { useState } from "react";
import type { ScenarioResult } from "@/lib/options";

interface ScenarioBarProps {
  scenarios: ScenarioResult[];
  ask: number;
}

function roiColor(roi: number): string {
  if (roi >= 50) return "var(--semantic-positive)";
  if (roi >= 0) return "var(--semantic-warning)";
  return "var(--semantic-negative)";
}

function roiBg(roi: number): string {
  if (roi >= 50) return "var(--semantic-positive-muted)";
  if (roi >= 0) return "var(--semantic-warning-muted)";
  return "var(--semantic-negative-muted)";
}

const MOVE_LABELS: Record<string, string> = {
  "No move": "Stock stays flat",
  "25%": "25% of the way to target",
  "50%": "Halfway to target",
  "75%": "75% of the way to target",
  "Target": "Coach's price target hit",
};

/**
 * Compact scenario bar with break-even marker, tooltips, and expandable detail.
 */
export function ScenarioBar({ scenarios, ask }: ScenarioBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!scenarios || scenarios.length === 0) return null;

  // Find break-even point (where ROI crosses from negative to positive)
  let breakEvenPct: number | null = null;
  for (let i = 1; i < scenarios.length; i++) {
    const prev = scenarios[i - 1];
    const curr = scenarios[i];
    if (prev.roi < 0 && curr.roi >= 0) {
      // Linear interpolation between segments
      const ratio = Math.abs(prev.roi) / (Math.abs(prev.roi) + curr.roi);
      // Each segment is 1/(scenarios.length) of the bar
      const segStart = (i - 1) / scenarios.length;
      const segWidth = 1 / scenarios.length;
      breakEvenPct = (segStart + segWidth * ratio) * 100;
      break;
    }
  }
  // All positive
  if (scenarios[0].roi >= 0) breakEvenPct = 0;

  return (
    <div
      style={{ marginTop: 10, cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed: compact bar with break-even marker */}
      {!expanded && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginRight: 6,
              flexShrink: 0,
            }}
          >
            Scenarios
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1,
              flex: 1,
              position: "relative",
            }}
          >
            {scenarios.map((s, i) => {
              const pct = Math.max(0, Math.min(100, (s.roi + 100) / 4));
              const isHovered = hoveredIdx === i;
              return (
                <div
                  key={s.label}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    position: "relative",
                  }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 6px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        whiteSpace: "nowrap",
                        zIndex: 10,
                        pointerEvents: "none",
                        boxShadow: "var(--shadow-md)",
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-primary)", marginBottom: 2 }}>
                        {MOVE_LABELS[s.label] ?? s.label}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                        Stock: <span style={{ fontFamily: "var(--font-dm-mono), monospace" }}>${s.stockPrice.toFixed(0)}</span>
                        {" · "}
                        Option: <span style={{ fontFamily: "var(--font-dm-mono), monospace" }}>${s.optionValue.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                  <div
                    style={{
                      height: 4,
                      width: "100%",
                      borderRadius: 2,
                      background: roiBg(s.roi),
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, Math.max(8, pct))}%`,
                        background: roiColor(s.roi),
                        opacity: isHovered ? 0.9 : 0.6,
                        borderRadius: 2,
                        transition: "opacity 0.12s ease",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: 9,
                      color: roiColor(s.roi),
                      opacity: 0.8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.roi >= 0 ? "+" : ""}{s.roi}%
                  </span>
                </div>
              );
            })}

            {/* Break-even marker */}
            {breakEvenPct !== null && breakEvenPct > 0 && breakEvenPct < 100 && (
              <div
                style={{
                  position: "absolute",
                  left: `${breakEvenPct}%`,
                  top: -2,
                  width: 1,
                  height: 8,
                  background: "var(--text-secondary)",
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
                title="Break-even point"
              >
                <span
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 8,
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    fontWeight: 500,
                  }}
                >
                  B/E
                </span>
              </div>
            )}
          </div>
          <span
            style={{
              fontSize: 9,
              color: "var(--text-tertiary)",
              marginLeft: 6,
              flexShrink: 0,
            }}
          >
            ▸
          </span>
        </div>
      )}

      {/* Expanded: full table */}
      {expanded && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                flex: 1,
              }}
            >
              Scenario Analysis
            </span>
            <span
              style={{
                fontSize: 9,
                color: "var(--text-tertiary)",
              }}
            >
              ▾
            </span>
          </div>

          {/* Header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 70px 70px 70px",
              gap: 4,
              padding: "4px 0",
              borderBottom: "1px solid var(--border-subtle)",
              marginBottom: 2,
            }}
          >
            {["Move", "Visual", "Stock", "Option", "ROI"].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: 9,
                  fontWeight: 500,
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  textAlign: h === "Move" ? "left" : "right",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {scenarios.map((s, i) => {
            const barWidth = Math.max(3, Math.min(100, ((s.optionValue / Math.max(ask * 3, 0.01)) * 100)));
            const isBreakEvenRow =
              i > 0 && scenarios[i - 1].roi < 0 && s.roi >= 0;
            return (
              <div key={s.label}>
                {/* Break-even indicator between rows */}
                {isBreakEvenRow && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "2px 0",
                    }}
                  >
                    <div style={{ flex: 1, height: 1, background: "var(--text-tertiary)", opacity: 0.3 }} />
                    <span style={{ fontSize: 8, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Break-even
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--text-tertiary)", opacity: 0.3 }} />
                  </div>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 1fr 70px 70px 70px",
                    gap: 4,
                    padding: "5px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color:
                        s.label === "Target"
                          ? "var(--accent-primary)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {s.label}
                  </span>

                  {/* Value bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      height: 16,
                    }}
                  >
                    <div
                      style={{
                        height: 4,
                        width: `${barWidth}%`,
                        background: roiColor(s.roi),
                        opacity: 0.5,
                        borderRadius: 2,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      textAlign: "right",
                    }}
                  >
                    ${s.stockPrice.toFixed(0)}
                  </span>

                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: 11,
                      color: "var(--text-primary)",
                      textAlign: "right",
                    }}
                  >
                    ${s.optionValue.toFixed(2)}
                  </span>

                  <span
                    style={{
                      fontFamily: "var(--font-dm-mono), monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      color: roiColor(s.roi),
                      textAlign: "right",
                    }}
                  >
                    {s.roi >= 0 ? "+" : ""}{s.roi}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
