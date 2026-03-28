"use client";

import { useState } from "react";
import type { EnrichedContract, TradeInput } from "@/lib/options";
import { blackScholes, daysUntil, formatMoney, formatPct } from "@/lib/options";
import { InfoTip } from "@/components/options-finder/InfoTip";

const DEFAULT_DISTANCES = [1, 3, 5, 10];

interface EstimatePanelProps {
  contract: EnrichedContract;
  trade: TradeInput;
  onClose: () => void;
}

interface PriceRow {
  label: string;
  price: number;
  side: "OTM" | "ATM" | "ITM";
}

interface TimeWindow {
  label: string;
  sub: string;
  daysLeft: number;
  color: string;
}

function formatDate(dateStr: string): string {
  const p = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return months[parseInt(p[1], 10) - 1] + " " + parseInt(p[2], 10);
}

export function EstimatePanel({ contract, trade, onClose }: EstimatePanelProps) {
  const [purchaseAmount, setPurchaseAmount] = useState(500);
  const [distances, setDistances] = useState<number[]>(DEFAULT_DISTANCES);
  const [customDist, setCustomDist] = useState("");

  const premium = contract.ask;
  const numContracts =
    purchaseAmount > 0 ? Math.floor(purchaseAmount / (premium * 100)) : 0;
  const actualCost = numContracts * premium * 100;
  const dte = contract.dte;

  // Time axis anchored to coach's projected date
  const projDays = Math.max(daysUntil(trade.projectedDate), 1);
  const earlyDays = Math.round(projDays / 2);
  const onTimeDays = projDays;
  const nearExpiryDays = dte;

  // Use contract's estimated IV (from enrichment), fall back to 0.25
  const iv = contract.iv > 0 ? contract.iv : 0.25;

  // Time windows
  const timeWindows: TimeWindow[] = [
    {
      label: "Early Exit",
      sub: `Day ${earlyDays} \u2014 ${Math.max(0, dte - earlyDays)} DTE left`,
      daysLeft: Math.max(0, dte - earlyDays),
      color: "var(--semantic-positive)",
    },
    {
      label: "On Time",
      sub: `Day ${onTimeDays} \u2014 ${Math.max(0, dte - onTimeDays)} DTE left`,
      daysLeft: Math.max(0, dte - onTimeDays),
      color: "var(--semantic-warning)",
    },
    {
      label: "Near Expiry",
      sub: `Day ${nearExpiryDays} \u2014 0 DTE left`,
      daysLeft: 0,
      color: "var(--semantic-negative)",
    },
  ];

  // Build price rows as a number line: -10, -5, -1, ATM, +1, +5, +10
  // Sorted ascending by price (lowest at top, highest at bottom)
  const priceRows: PriceRow[] = [];
  const sortedAsc = [...distances].sort((a, b) => a - b);
  const isCall = contract.contractType === "call";

  // Below strike: ascending by price (-$10, -$5, -$3, -$1)
  // Largest distance first so prices ascend toward strike
  [...sortedAsc].reverse().forEach((d) => {
    priceRows.push({
      label: `-$${d}`,
      price: contract.strike - d,
      side: isCall ? "OTM" : "ITM",
    });
  });

  priceRows.push({ label: "Strike", price: contract.strike, side: "ATM" });

  // Above strike: ascending by price (+$1, +$3, +$5, +$10)
  sortedAsc.forEach((d) => {
    priceRows.push({
      label: `+$${d}`,
      price: contract.strike + d,
      side: isCall ? "ITM" : "OTM",
    });
  });

  function addCustomDistance() {
    const val = parseInt(customDist, 10);
    if (val > 0 && !distances.includes(val)) {
      setDistances([...distances, val]);
      setCustomDist("");
    }
  }

  function removeDistance(d: number) {
    setDistances(distances.filter((v) => v !== d));
  }

  const typeLabel = contract.contractType === "call" ? "C" : "P";

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    fontSize: 10,
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  const infoTipText =
    numContracts > 0
      ? `${numContracts} contract${numContracts > 1 ? "s" : ""} \u00B7 ${formatMoney(actualCost)} actual cost`
      : `Min ${formatMoney(premium * 100)} for 1 contract`;

  return (
    <div
      style={{
        background: "var(--bg-surface-hover)",
        borderTop: "1px solid rgba(124,124,255,0.20)",
        borderBottom: "1px solid var(--border-default)",
        borderLeft: "1px solid var(--border-default)",
        borderRight: "1px solid var(--border-default)",
        borderRadius: "0 0 12px 12px",
        marginTop: 0,
        marginBottom: 10,
        padding: "20px 22px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent-primary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Estimate
          </span>
          <span
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {formatMoney(contract.strike)} {typeLabel} · {formatDate(contract.expiry)}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 11,
            color: "var(--text-tertiary)",
            background: "transparent",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      {/* Inputs row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 18,
          paddingBottom: 16,
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        {/* Investment amount */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <label style={labelStyle}>Investment</label>
            <InfoTip text={infoTipText} />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 13,
                color: "var(--text-tertiary)",
                padding: "0 0 0 10px",
              }}
            >
              $
            </span>
            <input
              type="number"
              step={100}
              min={0}
              value={purchaseAmount}
              onChange={(e) =>
                setPurchaseAmount(parseInt(e.target.value, 10) || 0)
              }
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 13,
                color: "var(--text-primary)",
                background: "transparent",
                border: "none",
                outline: "none",
                padding: "7px 10px 7px 4px",
                width: 90,
              }}
            />
          </div>
        </div>

        {/* Distance chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>Distance from Strike ($)</label>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              flexWrap: "wrap",
            }}
          >
            {[...distances].sort((a, b) => a - b).map((d) => (
              <div
                key={d}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: 11,
                  color: "var(--text-primary)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 6,
                  padding: "5px 8px",
                }}
              >
                ${d}
                <button
                  onClick={() => removeDistance(d)}
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 1px",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  padding: "0 0 0 8px",
                }}
              >
                +$
              </span>
              <input
                type="number"
                min={1}
                placeholder="custom"
                value={customDist}
                onChange={(e) => setCustomDist(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomDistance();
                }}
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: 11,
                  color: "var(--text-primary)",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  padding: "5px 8px 5px 4px",
                  width: 55,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {numContracts > 0 ? (
        <div>
          {/* Legend */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 12,
            }}
          >
            <span style={labelStyle}>
              If target price hits — estimated option value + total return on{" "}
              {formatMoney(actualCost)} invested
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--border-default)",
                      background: "var(--bg-surface)",
                      borderRadius: "6px 0 0 0",
                      position: "sticky",
                      left: 0,
                    }}
                  >
                    Ticker Price
                  </th>
                  {timeWindows.map((tw, ti) => (
                    <th
                      key={ti}
                      style={{
                        textAlign: "center",
                        padding: "8px 12px",
                        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                        fontSize: 10,
                        fontWeight: 600,
                        color: tw.color,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        borderBottom: "1px solid var(--border-default)",
                        background: "var(--bg-surface)",
                        borderRadius: ti === 2 ? "0 6px 0 0" : undefined,
                        minWidth: 140,
                      }}
                    >
                      <div>{tw.label}</div>
                      <div
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                          fontSize: 9,
                          fontWeight: 400,
                          color: "var(--text-tertiary)",
                          marginTop: 2,
                          textTransform: "none",
                          letterSpacing: "0",
                        }}
                      >
                        {tw.sub}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priceRows.map((row, ri) => {
                  const isStrike = row.side === "ATM";
                  const rowBg = isStrike
                    ? "var(--accent-muted)"
                    : ri % 2 === 0
                      ? "transparent"
                      : "rgba(24,24,27,0.4)";

                  const sideColor =
                    row.side === "ITM"
                      ? "var(--semantic-positive)"
                      : row.side === "OTM"
                        ? "var(--semantic-warning)"
                        : "var(--accent-primary)";
                  const sideBg =
                    row.side === "ITM"
                      ? "var(--semantic-positive-muted)"
                      : row.side === "OTM"
                        ? "var(--semantic-warning-muted)"
                        : "var(--accent-muted)";

                  return (
                    <tr key={ri}>
                      <td
                        style={{
                          padding: "8px 12px",
                          borderBottom: "1px solid rgba(30,35,48,0.6)",
                          background: rowBg,
                          position: "sticky",
                          left: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "var(--font-dm-mono), monospace",
                              fontSize: 12,
                              fontWeight: isStrike ? 600 : 400,
                              color: isStrike
                                ? "var(--accent-primary)"
                                : "var(--text-primary)",
                            }}
                          >
                            {formatMoney(row.price)}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                              fontSize: 9,
                              fontWeight: 500,
                              color: sideColor,
                              background: sideBg,
                              padding: "1px 5px",
                              borderRadius: 3,
                            }}
                          >
                            {row.side}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                              fontSize: 9,
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {row.label}
                          </span>
                        </div>
                      </td>

                      {timeWindows.map((tw, ti) => {
                        const T = Math.max(tw.daysLeft / 365, 0);
                        const optPrice = blackScholes(
                          row.price,
                          contract.strike,
                          T,
                          0.045,
                          iv,
                          contract.contractType
                        );
                        const totalValue = optPrice * numContracts * 100;
                        const pnl = totalValue - actualCost;
                        const roi =
                          actualCost > 0 ? (pnl / actualCost) * 100 : 0;
                        const isProfit = pnl >= 0;
                        const pnlColor = isProfit
                          ? "var(--semantic-positive)"
                          : "var(--semantic-negative)";

                        return (
                          <td
                            key={ti}
                            style={{
                              padding: "8px 12px",
                              textAlign: "center",
                              borderBottom: "1px solid rgba(30,35,48,0.6)",
                              background: rowBg,
                            }}
                          >
                            <div
                              style={{
                                fontFamily: "var(--font-dm-mono), monospace",
                                fontSize: 12,
                                fontWeight: 500,
                                color: "var(--text-primary)",
                                marginBottom: 2,
                              }}
                            >
                              {formatMoney(
                                Math.round(optPrice * 100) / 100
                              )}
                            </div>
                            <div
                              style={{
                                fontFamily: "var(--font-dm-mono), monospace",
                                fontSize: 11,
                                fontWeight: 600,
                                color: pnlColor,
                              }}
                            >
                              {formatPct(Math.round(roi * 10) / 10)}
                            </div>
                            <div
                              style={{
                                fontFamily: "var(--font-dm-mono), monospace",
                                fontSize: 9,
                                color: pnlColor,
                                opacity: 0.7,
                                marginTop: 1,
                              }}
                            >
                              {isProfit ? "+" : ""}
                              {formatMoney(Math.round(pnl * 100) / 100)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 9,
                color: "var(--text-tertiary)",
              }}
            >
              Based on {numContracts} contract{numContracts > 1 ? "s" : ""} (
              {formatMoney(actualCost)} invested) · Early = halfway to projected
              · On Time = projected date · Near Expiry = at contract expiry
            </span>
            <span
              style={{
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 9,
                color: "var(--semantic-warning)",
                fontStyle: "italic",
              }}
            >
              Simplified Black-Scholes estimate — actual prices will vary
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: 20,
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 12,
            color: "var(--text-tertiary)",
          }}
        >
          Enter at least {formatMoney(premium * 100)} to purchase 1 contract
        </div>
      )}
    </div>
  );
}
