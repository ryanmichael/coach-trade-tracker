"use client";

import { useEffect, useState } from "react";
import { ShimmerLoader } from "@/components/primitives/ShimmerLoader";

// ── Types ────────────────────────────────────────────────────────────────────

interface AccuracyData {
  totalValidated: number;
  totalPredictions: number;
  pendingValidation: number;
  message?: string;
  accuracy?: {
    avgPredictionError: number;
    medianPredictionError: number;
    directionAccuracy: string | null;
    directionCorrectCount: number;
    directionTotalChecked: number;
  };
  bestMatchPerformance?: {
    bestMatchAvgActualROI: number | null;
    otherAvgActualROI: number | null;
    bestMatchOutperforms: boolean | null;
  };
  byDirection?: {
    long: { count: number; directionAccuracy: string };
    short: { count: number; directionAccuracy: string };
  };
  ivCalibration?: {
    avgEstimatedIV: string;
  };
  roiPairs?: Array<{
    predicted: number;
    actual: number;
    ticker: string;
    direction: string;
    rank: number;
  }>;
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
        padding: "16px 20px",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-dm-mono), monospace",
          fontSize: 24,
          fontWeight: 400,
          color: color ?? "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            marginTop: 6,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

// ── ROI Scatter Dot ──────────────────────────────────────────────────────────

function ScatterPlot({
  pairs,
}: {
  pairs: AccuracyData["roiPairs"];
}) {
  if (!pairs || pairs.length === 0) return null;

  const W = 480;
  const H = 280;
  const PAD = { top: 20, right: 20, bottom: 36, left: 46 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Compute axis bounds from data
  const allVals = pairs.flatMap((p) => [p.predicted, p.actual]);
  const rawMin = Math.min(...allVals, -50);
  const rawMax = Math.max(...allVals, 100);
  const range = rawMax - rawMin;
  const axMin = rawMin - range * 0.1;
  const axMax = rawMax + range * 0.1;

  const toX = (v: number) => PAD.left + ((v - axMin) / (axMax - axMin)) * plotW;
  const toY = (v: number) => PAD.top + plotH - ((v - axMin) / (axMax - axMin)) * plotH;

  // Grid lines
  const step = Math.pow(10, Math.floor(Math.log10(axMax - axMin))) / 2;
  const gridVals: number[] = [];
  for (let v = Math.ceil(axMin / step) * step; v <= axMax; v += step) {
    gridVals.push(v);
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 12,
        }}
      >
        Predicted vs Actual ROI
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {/* Grid */}
        {gridVals.map((v) => (
          <g key={v}>
            <line
              x1={toX(v)}
              y1={PAD.top}
              x2={toX(v)}
              y2={PAD.top + plotH}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={0.5}
            />
            <line
              x1={PAD.left}
              y1={toY(v)}
              x2={PAD.left + plotW}
              y2={toY(v)}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Perfect prediction line (diagonal) */}
        <line
          x1={toX(axMin)}
          y1={toY(axMin)}
          x2={toX(axMax)}
          y2={toY(axMax)}
          stroke="var(--accent-primary)"
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.3}
        />

        {/* Zero lines */}
        <line
          x1={toX(0)}
          y1={PAD.top}
          x2={toX(0)}
          y2={PAD.top + plotH}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5}
        />
        <line
          x1={PAD.left}
          y1={toY(0)}
          x2={PAD.left + plotW}
          y2={toY(0)}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5}
        />

        {/* Data points */}
        {pairs.map((p, i) => {
          const cx = toX(p.predicted);
          const cy = toY(p.actual);
          const isLong = p.direction === "LONG";
          const color = p.actual >= 0 ? "var(--semantic-positive)" : "var(--semantic-negative)";
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r={p.rank === 1 ? 5 : 3.5}
                fill={color}
                opacity={p.rank === 1 ? 0.9 : 0.5}
                stroke={p.rank === 1 ? color : "none"}
                strokeWidth={p.rank === 1 ? 1 : 0}
              />
              {p.rank === 1 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill="none"
                  stroke={color}
                  strokeWidth={0.5}
                  opacity={0.3}
                />
              )}
            </g>
          );
        })}

        {/* Axis labels */}
        {gridVals.filter((_, i) => i % 2 === 0).map((v) => (
          <g key={`label-${v}`}>
            <text
              x={toX(v)}
              y={PAD.top + plotH + 16}
              textAnchor="middle"
              fontSize={9}
              fontFamily="var(--font-dm-mono), monospace"
              fill="var(--text-tertiary)"
            >
              {v > 0 ? `+${v}%` : `${v}%`}
            </text>
            <text
              x={PAD.left - 8}
              y={toY(v) + 3}
              textAnchor="end"
              fontSize={9}
              fontFamily="var(--font-dm-mono), monospace"
              fill="var(--text-tertiary)"
            >
              {v > 0 ? `+${v}%` : `${v}%`}
            </text>
          </g>
        ))}

        {/* Axis titles */}
        <text
          x={PAD.left + plotW / 2}
          y={H - 2}
          textAnchor="middle"
          fontSize={9}
          fill="var(--text-tertiary)"
          fontFamily="var(--font-dm-sans), system-ui"
        >
          Predicted ROI
        </text>
        <text
          x={10}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          fontSize={9}
          fill="var(--text-tertiary)"
          fontFamily="var(--font-dm-sans), system-ui"
          transform={`rotate(-90, 10, ${PAD.top + plotH / 2})`}
        >
          Actual ROI
        </text>
      </svg>

      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          marginTop: 8,
          fontSize: 10,
          color: "var(--text-tertiary)",
        }}
      >
        <span>
          <span style={{ color: "var(--semantic-positive)" }}>●</span> Profitable
        </span>
        <span>
          <span style={{ color: "var(--semantic-negative)" }}>●</span> Unprofitable
        </span>
        <span>
          <span style={{ fontSize: 8 }}>◉</span> Best match
        </span>
        <span style={{ color: "var(--accent-primary)", opacity: 0.5 }}>
          ╌ Perfect prediction
        </span>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export function AccuracyDashboard() {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/options/accuracy")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flex: 1 }}>
              <ShimmerLoader width="100%" height={90} rounded="8px" />
            </div>
          ))}
        </div>
        <ShimmerLoader width="100%" height={300} rounded="8px" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "16px 20px",
          background: "var(--semantic-negative-muted)",
          border: "1px solid rgba(240,110,110,0.25)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--semantic-negative)",
          marginTop: 16,
        }}
      >
        Failed to load accuracy data: {error}
      </div>
    );
  }

  if (!data || data.totalPredictions === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "var(--text-tertiary)",
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>
          No predictions yet
        </div>
        <div style={{ fontSize: 12 }}>
          Use the Options Finder to generate predictions. They&apos;ll be automatically
          tracked and validated against actual prices.
        </div>
      </div>
    );
  }

  const hasValidated = data.totalValidated > 0;
  const acc = data.accuracy;
  const bm = data.bestMatchPerformance;
  const dir = data.byDirection;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Summary stats */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <StatCard
          label="Predictions"
          value={String(data.totalPredictions)}
          sub={`${data.totalValidated} validated · ${data.pendingValidation} pending`}
        />
        {hasValidated && acc ? (
          <>
            <StatCard
              label="Direction Accuracy"
              value={acc.directionAccuracy ?? "—"}
              sub={`${acc.directionCorrectCount}/${acc.directionTotalChecked} correct`}
              color={
                acc.directionAccuracy && parseFloat(acc.directionAccuracy) >= 60
                  ? "var(--semantic-positive)"
                  : acc.directionAccuracy && parseFloat(acc.directionAccuracy) < 40
                    ? "var(--semantic-negative)"
                    : "var(--text-primary)"
              }
            />
            <StatCard
              label="Avg Prediction Error"
              value={`${acc.avgPredictionError}%`}
              sub={`Median: ${acc.medianPredictionError}%`}
            />
            <StatCard
              label="Best Match ROI"
              value={
                bm?.bestMatchAvgActualROI !== null && bm?.bestMatchAvgActualROI !== undefined
                  ? `${bm.bestMatchAvgActualROI > 0 ? "+" : ""}${bm.bestMatchAvgActualROI}%`
                  : "—"
              }
              sub={
                bm?.bestMatchOutperforms === true
                  ? "Outperforms other picks"
                  : bm?.bestMatchOutperforms === false
                    ? "Underperforms other picks"
                    : undefined
              }
              color={
                bm?.bestMatchAvgActualROI !== null && bm?.bestMatchAvgActualROI !== undefined
                  ? bm.bestMatchAvgActualROI >= 0
                    ? "var(--semantic-positive)"
                    : "var(--semantic-negative)"
                  : undefined
              }
            />
          </>
        ) : (
          <StatCard
            label="Status"
            value="Waiting"
            sub="Predictions will be validated after their projected dates pass"
          />
        )}
      </div>

      {/* Direction breakdown */}
      {hasValidated && dir && (dir.long.count > 0 || dir.short.count > 0) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {dir.long.count > 0 && (
            <div
              style={{
                flex: 1,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--semantic-positive)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Long
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    marginLeft: 8,
                  }}
                >
                  {dir.long.count} predictions
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: 16,
                  color: "var(--text-primary)",
                }}
              >
                {dir.long.directionAccuracy}
              </span>
            </div>
          )}
          {dir.short.count > 0 && (
            <div
              style={{
                flex: 1,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--semantic-negative)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Short
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    marginLeft: 8,
                  }}
                >
                  {dir.short.count} predictions
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: 16,
                  color: "var(--text-primary)",
                }}
              >
                {dir.short.directionAccuracy}
              </span>
            </div>
          )}
        </div>
      )}

      {/* IV Calibration */}
      {hasValidated && data.ivCalibration && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            padding: "14px 20px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            Average Estimated IV
          </div>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 14,
              color: "var(--text-primary)",
            }}
          >
            {data.ivCalibration.avgEstimatedIV}
          </span>
        </div>
      )}

      {/* Scatter plot */}
      {hasValidated && data.roiPairs && data.roiPairs.length > 0 && (
        <ScatterPlot pairs={data.roiPairs} />
      )}

      {/* Methodology note */}
      <div
        style={{
          marginTop: 20,
          padding: "14px 18px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          fontSize: 11,
          color: "var(--text-tertiary)",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "var(--text-secondary)", fontWeight: 500 }}>How it works:</strong>{" "}
        Every options chain query saves the top 3 contracts as prediction snapshots. After the projected
        date passes, the daily validation job fetches actual prices and computes real ROI vs. predicted
        ROI. Direction accuracy measures how often we correctly predicted profitable vs. unprofitable.
        Scatter dots closer to the diagonal line indicate more accurate predictions.
      </div>
    </div>
  );
}
