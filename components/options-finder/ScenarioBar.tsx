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

/**
 * Compact horizontal scenario bar showing 5 price outcomes.
 * Collapsed: 5 color-coded dots with labels.
 * Expanded: full row with stock price, option value, and ROI.
 */
export function ScenarioBar({ scenarios, ask }: ScenarioBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (!scenarios || scenarios.length === 0) return null;

  return (
    <div
      style={{ marginTop: 10, cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Collapsed: compact dot row */}
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
              alignItems: "center",
              gap: 1,
              flex: 1,
            }}
          >
            {scenarios.map((s) => {
              const pct = Math.max(0, Math.min(100, (s.roi + 100) / 4));
              return (
                <div
                  key={s.label}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                  title={`${s.label}: $${s.stockPrice} → ${s.roi >= 0 ? "+" : ""}${s.roi}% ROI`}
                >
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
                        opacity: 0.6,
                        borderRadius: 2,
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
          {scenarios.map((s) => {
            const barWidth = Math.max(3, Math.min(100, ((s.optionValue / Math.max(ask * 3, 0.01)) * 100)));
            return (
              <div
                key={s.label}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
