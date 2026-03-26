"use client";

import type { EnrichedContract } from "@/lib/options";
import { formatMoney, formatPct, formatDate } from "@/lib/options";
import { ScenarioBar } from "@/components/options-finder/ScenarioBar";

interface ContractCardProps {
  contract: EnrichedContract;
  rank: number;
  maxOI: number;
}

function DeltaBadge({ delta }: { delta: number }) {
  const absDelta = Math.abs(delta);
  // Color by ideal range: 0.25-0.40 = green (ideal), outside = yellow/red
  let color = "var(--semantic-warning)";
  let bg = "var(--semantic-warning-muted)";
  let label = "";

  if (absDelta >= 0.25 && absDelta <= 0.45) {
    color = "var(--semantic-positive)";
    bg = "var(--semantic-positive-muted)";
    label = "ideal";
  } else if (absDelta >= 0.15 && absDelta < 0.25) {
    label = "speculative";
  } else if (absDelta > 0.45 && absDelta <= 0.70) {
    label = "conservative";
  } else if (absDelta > 0.70) {
    color = "var(--text-tertiary)";
    bg = "var(--bg-surface-hover)";
    label = "deep ITM";
  } else {
    color = "var(--semantic-negative)";
    bg = "var(--semantic-negative-muted)";
    label = "lottery";
  }

  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 500,
        color,
        background: bg,
        padding: "2px 6px",
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
      title={`Delta: ${delta.toFixed(3)} — ${label}`}
    >
      δ {absDelta.toFixed(2)} {label}
    </span>
  );
}

export function ContractCard({ contract: c, rank, maxOI }: ContractCardProps) {
  const isBest = c.isSweetSpot;
  const borderColor = isBest
    ? "rgba(63,207,142,0.25)"
    : "var(--border-default)";
  const bgColor = isBest
    ? "rgba(63,207,142,0.06)"
    : "var(--bg-surface)";
  const fwdRoiColor =
    c.forwardROI >= 0 ? "var(--semantic-positive)" : "var(--semantic-negative)";
  const typeLabel = c.contractType === "call" ? "C" : "P";
  const moneynessColor =
    c.moneyness === "OTM"
      ? "var(--semantic-warning)"
      : "var(--semantic-positive)";
  const moneynessBg =
    c.moneyness === "OTM"
      ? "var(--semantic-warning-muted)"
      : "var(--semantic-positive-muted)";

  const dividerStyle: React.CSSProperties = {
    width: 1,
    height: 36,
    background: "var(--border-strong)",
    flexShrink: 0,
  };

  // Score bar width (0-100%)
  const scoreWidth = Math.round(c.compositeScore * 100);

  return (
    <div
      style={{
        background: bgColor,
        border: "1px solid " + borderColor,
        borderRadius: 12,
        padding: "18px 22px",
        marginBottom: 10,
        position: "relative",
        transition: "border-color 0.15s ease",
      }}
    >
      {/* Sweet Spot badge */}
      {isBest && (
        <div
          style={{
            position: "absolute",
            top: -1,
            right: 20,
            background: "var(--semantic-positive)",
            color: "#0B0D11",
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "3px 10px 4px",
            borderRadius: "0 0 6px 6px",
          }}
        >
          Best Match
        </div>
      )}

      {/* Main row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        {/* Rank */}
        <div
          style={{
            fontFamily: "var(--font-dm-mono), monospace",
            fontSize: 14,
            fontWeight: 600,
            color: isBest
              ? "var(--semantic-positive)"
              : "var(--text-tertiary)",
            width: 20,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          #{rank}
        </div>

        {/* Strike + Moneyness + Delta */}
        <div style={{ minWidth: 90, flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              {formatMoney(c.strike)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text-tertiary)",
              }}
            >
              {typeLabel}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: moneynessColor,
                background: moneynessBg,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {c.moneyness}
            </span>
            <DeltaBadge delta={c.delta} />
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Expiry + DTE */}
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 13,
              color: "var(--text-primary)",
            }}
          >
            {formatDate(c.expiry)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginTop: 2,
            }}
          >
            {c.dte} DTE
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Premium + Theta */}
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 13,
              color: "var(--text-primary)",
            }}
          >
            {formatMoney(c.ask)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginTop: 2,
              display: "flex",
              gap: 6,
            }}
          >
            <span>ask · {c.spread.toFixed(1)}%</span>
            <span
              style={{ color: "var(--semantic-negative)" }}
              title="Daily theta decay"
            >
              θ {c.theta.toFixed(3)}/d
            </span>
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Forward Value + IV */}
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 13,
              color: "var(--semantic-positive)",
            }}
          >
            {formatMoney(c.forwardValue)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginTop: 2,
            }}
          >
            fwd value · IV {(c.iv * 100).toFixed(0)}%
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Break-even */}
        <div style={{ minWidth: 70, flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            {formatMoney(c.breakeven)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginTop: 2,
            }}
          >
            break-even
          </div>
        </div>

        {/* Forward ROI */}
        <div
          style={{
            marginLeft: "auto",
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 22,
              fontWeight: 700,
              color: fwdRoiColor,
              letterSpacing: "-0.02em",
            }}
          >
            {formatPct(c.forwardROI)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginTop: 1,
            }}
          >
            est. ROI
          </div>
        </div>
      </div>

      {/* Score + OI bar row */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Composite score bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              flexShrink: 0,
              width: 34,
            }}
          >
            Score
          </span>
          <div
            style={{
              flex: 1,
              height: 3,
              background: "var(--bg-surface-hover)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: scoreWidth + "%",
                background: isBest
                  ? "rgba(63,207,142,0.50)"
                  : "rgba(124,124,255,0.40)",
                borderRadius: 2,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 10,
              fontWeight: 500,
              color: isBest ? "var(--semantic-positive)" : "var(--accent-primary)",
              flexShrink: 0,
              width: 28,
              textAlign: "right",
            }}
          >
            {scoreWidth}
          </span>
        </div>

        {/* OI */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: 120,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              flexShrink: 0,
            }}
          >
            OI
          </span>
          <div
            style={{
              flex: 1,
              height: 3,
              background: "var(--bg-surface-hover)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width:
                  Math.min(100, (c.openInterest / Math.max(maxOI, 1)) * 100) +
                  "%",
                background: "rgba(124,124,255,0.20)",
                borderRadius: 2,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 10,
              color: "var(--text-tertiary)",
              flexShrink: 0,
            }}
          >
            {c.openInterest.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Scenario analysis */}
      <ScenarioBar scenarios={c.scenarios} ask={c.ask} />
    </div>
  );
}
