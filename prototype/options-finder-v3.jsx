import { useState } from "react";

/* ───────────────────────────────────────────────────────────────
   Options Finder v3 — Phase 1: Basic ROI Ranking
   + Ticker selection & custom ticker input
   + Estimate Panel (inline scenario matrix)
   Mercury Dark Mode Design System
   ─────────────────────────────────────────────────────────────── */

var COLORS = {
  bg: "#0B0D11",
  surface: "#12151B",
  surfaceAlt: "#181C24",
  border: "#1E2330",
  borderLight: "#2A3040",
  textPrimary: "#E8E9ED",
  textSecondary: "#8B8FA3",
  textTertiary: "#5C6178",
  accent: "#7C7CFF",
  accentDim: "rgba(124,124,255,0.12)",
  positive: "#3FCF8E",
  positiveDim: "rgba(63,207,142,0.10)",
  negative: "#FF6B6B",
  negativeDim: "rgba(255,107,107,0.10)",
  warning: "#FFB547",
  warningDim: "rgba(255,181,71,0.10)",
  sweetSpot: "#3FCF8E",
  sweetSpotDim: "rgba(63,207,142,0.06)",
  sweetSpotBorder: "rgba(63,207,142,0.25)",
};

var FONTS = {
  sans: "'DM Sans', system-ui, sans-serif",
  mono: "'DM Mono', 'SF Mono', monospace",
};

/* ── Mock ParsedTrades ────────────────────────────────────────── */
var MOCK_TRADES = {
  SPY: {
    ticker: "SPY", direction: "LONG", currentPrice: 561.42, priceTargetHigh: 582.00,
    projectedDate: "2026-04-18", stopLoss: 548.00,
    coachNote: "Wyckoff accumulation phase complete. Spring confirmed on daily chart. Targeting measured move to $582 by mid-April.",
    hasCoachRec: true,
  },
  AAPL: {
    ticker: "AAPL", direction: "LONG", currentPrice: 218.54, priceTargetHigh: 235.00,
    projectedDate: "2026-04-25", stopLoss: 210.00,
    coachNote: "Breakout from 3-month consolidation range. Volume confirming. Measured target $235 based on prior range height.",
    hasCoachRec: true,
  },
  TSLA: {
    ticker: "TSLA", direction: "SHORT", currentPrice: 274.80, priceTargetHigh: 245.00,
    projectedDate: "2026-04-11", stopLoss: 290.00,
    coachNote: "Distribution complete on weekly. Upthrust confirmed at $285 resistance. Expecting markdown phase to $245 support.",
    hasCoachRec: true,
  },
};

var MOCK_CHAINS = {
  SPY: [
    { id: "SPY260501C00570", strike: 570, expiry: "2026-05-01", ask: 8.45, bid: 8.20, openInterest: 14280, contractType: "call", isSweetSpot: false },
    { id: "SPY260501C00575", strike: 575, expiry: "2026-05-01", ask: 5.80, bid: 5.55, openInterest: 9840, contractType: "call", isSweetSpot: true },
    { id: "SPY260501C00580", strike: 580, expiry: "2026-05-01", ask: 3.65, bid: 3.40, openInterest: 7220, contractType: "call", isSweetSpot: false },
    { id: "SPY260515C00575", strike: 575, expiry: "2026-05-15", ask: 7.10, bid: 6.85, openInterest: 5640, contractType: "call", isSweetSpot: false },
    { id: "SPY260515C00580", strike: 580, expiry: "2026-05-15", ask: 4.95, bid: 4.70, openInterest: 4180, contractType: "call", isSweetSpot: false },
  ],
  AAPL: [
    { id: "AAPL260508C00220", strike: 220, expiry: "2026-05-08", ask: 7.90, bid: 7.65, openInterest: 18400, contractType: "call", isSweetSpot: false },
    { id: "AAPL260508C00225", strike: 225, expiry: "2026-05-08", ask: 5.20, bid: 4.95, openInterest: 12300, contractType: "call", isSweetSpot: true },
    { id: "AAPL260508C00230", strike: 230, expiry: "2026-05-08", ask: 3.10, bid: 2.85, openInterest: 8900, contractType: "call", isSweetSpot: false },
    { id: "AAPL260522C00225", strike: 225, expiry: "2026-05-22", ask: 6.80, bid: 6.50, openInterest: 6200, contractType: "call", isSweetSpot: false },
    { id: "AAPL260522C00230", strike: 230, expiry: "2026-05-22", ask: 4.45, bid: 4.15, openInterest: 5100, contractType: "call", isSweetSpot: false },
  ],
  TSLA: [
    { id: "TSLA260424P00270", strike: 270, expiry: "2026-04-24", ask: 12.30, bid: 11.90, openInterest: 22100, contractType: "put", isSweetSpot: false },
    { id: "TSLA260424P00260", strike: 260, expiry: "2026-04-24", ask: 7.50, bid: 7.15, openInterest: 15800, contractType: "put", isSweetSpot: true },
    { id: "TSLA260424P00250", strike: 250, expiry: "2026-04-24", ask: 4.20, bid: 3.90, openInterest: 11200, contractType: "put", isSweetSpot: false },
    { id: "TSLA260508P00260", strike: 260, expiry: "2026-05-08", ask: 9.80, bid: 9.45, openInterest: 8600, contractType: "put", isSweetSpot: false },
    { id: "TSLA260508P00250", strike: 250, expiry: "2026-05-08", ask: 6.40, bid: 6.05, openInterest: 7300, contractType: "put", isSweetSpot: false },
  ],
};

/* ── Helpers ────────────────────────────────────────────────────── */
function calcROI(strike, ask, targetPrice, contractType) {
  var intrinsic = 0;
  if (contractType === "call") { intrinsic = Math.max(0, targetPrice - strike); }
  else { intrinsic = Math.max(0, strike - targetPrice); }
  return ((intrinsic - ask) / ask) * 100;
}
function calcBreakeven(strike, ask, contractType) {
  return contractType === "call" ? strike + ask : strike - ask;
}
function calcEstValue(strike, targetPrice, contractType) {
  return contractType === "call" ? Math.max(0, targetPrice - strike) : Math.max(0, strike - targetPrice);
}
function formatMoney(val) { return "$" + val.toFixed(2); }
function formatPct(val) { return (val >= 0 ? "+" : "") + val.toFixed(1) + "%"; }
function formatDate(dateStr) {
  var p = dateStr.split("-");
  var m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return m[parseInt(p[1], 10) - 1] + " " + parseInt(p[2], 10);
}
function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date("2026-03-25")) / 86400000);
}
function spreadPct(bid, ask) {
  var mid = (bid + ask) / 2;
  return mid === 0 ? 0 : ((ask - bid) / mid) * 100;
}
function moneynessLabel(strike, currentPrice, contractType) {
  if (contractType === "call") {
    if (strike < currentPrice) return "ITM";
    if (strike === currentPrice) return "ATM";
    return "OTM";
  }
  if (strike > currentPrice) return "ITM";
  if (strike === currentPrice) return "ATM";
  return "OTM";
}

/* ── Simplified Black-Scholes estimate ─────────────────────────
   Approximate option price given: stock price, strike, days remaining,
   IV (assumed), risk-free rate (assumed). Uses the BS formula with
   cumulative normal distribution approximation.
   ────────────────────────────────────────────────────────────── */
function cumulativeNormal(x) {
  var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  var a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  var sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  var t = 1.0 / (1.0 + p * x);
  var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function estimateOptionPrice(stockPrice, strike, daysRemaining, contractType, iv) {
  if (daysRemaining <= 0) {
    if (contractType === "call") return Math.max(0, stockPrice - strike);
    return Math.max(0, strike - stockPrice);
  }
  var S = stockPrice;
  var K = strike;
  var T = daysRemaining / 365;
  var r = 0.045;
  var sigma = iv || 0.25;
  var sqrtT = Math.sqrt(T);
  var d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  var d2 = d1 - sigma * sqrtT;
  if (contractType === "call") {
    return S * cumulativeNormal(d1) - K * Math.exp(-r * T) * cumulativeNormal(d2);
  }
  return K * Math.exp(-r * T) * cumulativeNormal(-d2) - S * cumulativeNormal(-d1);
}

function enrichContracts(contracts, trade) {
  return contracts.map(function(c) {
    return Object.assign({}, c, {
      roi: calcROI(c.strike, c.ask, trade.priceTargetHigh, c.contractType),
      breakeven: calcBreakeven(c.strike, c.ask, c.contractType),
      estValue: calcEstValue(c.strike, trade.priceTargetHigh, c.contractType),
      spread: spreadPct(c.bid, c.ask),
      dte: daysUntil(c.expiry),
      moneyness: moneynessLabel(c.strike, trade.currentPrice, c.contractType),
    });
  }).sort(function(a, b) { return b.roi - a.roi; });
}

/* ── Info Tooltip ───────────────────────────────────────────────── */

function InfoTip(props) {
  var [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onMouseEnter={function() { setVisible(true); }}
        onMouseLeave={function() { setVisible(false); }}
        onClick={function() { setVisible(!visible); }}
        style={{
          width: 14, height: 14, borderRadius: "50%",
          background: "transparent",
          border: "1px solid " + COLORS.textTertiary + "88",
          color: COLORS.textTertiary,
          fontFamily: FONTS.sans, fontSize: 8, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", padding: 0, lineHeight: 1,
        }}
      >i</button>
      {visible ? (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: COLORS.surface, border: "1px solid " + COLORS.borderLight,
          borderRadius: 6, padding: "6px 10px",
          fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textSecondary,
          whiteSpace: "nowrap", zIndex: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {props.text}
          <div style={{
            position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid " + COLORS.borderLight,
          }} />
        </div>
      ) : null}
    </div>
  );
}

/* ── Estimate Panel ────────────────────────────────────────────── */

var DEFAULT_DISTANCES = [1, 3, 5, 10];

function EstimatePanel(props) {
  var contract = props.contract;
  var trade = props.trade;
  var onClose = props.onClose;

  var [purchaseAmount, setPurchaseAmount] = useState(500);
  var [distances, setDistances] = useState(DEFAULT_DISTANCES);
  var [customDist, setCustomDist] = useState("");
  var [showResults, setShowResults] = useState(true);

  var premium = contract.ask;
  var numContracts = purchaseAmount > 0 ? Math.floor(purchaseAmount / (premium * 100)) : 0;
  var actualCost = numContracts * premium * 100;
  var dte = contract.dte;

  /* Time axis anchored to coach's projected date, not contract expiry.
     "Early"      = halfway to projected date (lots of time value left)
     "On Time"    = at projected date
     "Near Expiry" = at contract expiry (time value ~0)
     daysFromNow = how many days from today the scenario occurs
     daysToExpiry = days remaining on the contract at that point */
  var projDays = daysUntil(trade.projectedDate);
  var earlyDays = Math.round(projDays / 2);
  var onTimeDays = projDays;
  var nearExpiryDays = dte;

  /* Price rows: strike +/- each distance */
  var priceRows = [];
  var sortedDist = distances.slice().sort(function(a, b) { return b - a; });

  /* For calls: show from highest OTM to deepest ITM
     For puts: show from deepest ITM to highest OTM */
  if (contract.contractType === "call") {
    sortedDist.forEach(function(d) {
      priceRows.push({ label: "-$" + d, price: contract.strike - d, side: "OTM" });
    });
    priceRows.push({ label: "Strike", price: contract.strike, side: "ATM" });
    var ascDist = distances.slice().sort(function(a, b) { return a - b; });
    ascDist.forEach(function(d) {
      priceRows.push({ label: "+$" + d, price: contract.strike + d, side: "ITM" });
    });
  } else {
    var ascDistP = distances.slice().sort(function(a, b) { return a - b; });
    ascDistP.forEach(function(d) {
      priceRows.push({ label: "+$" + d, price: contract.strike + d, side: "OTM" });
    });
    priceRows.push({ label: "Strike", price: contract.strike, side: "ATM" });
    sortedDist.forEach(function(d) {
      priceRows.push({ label: "-$" + d, price: contract.strike - d, side: "ITM" });
    });
  }

  function addCustomDistance() {
    var val = parseInt(customDist, 10);
    if (val > 0 && distances.indexOf(val) < 0) {
      setDistances(distances.concat([val]));
      setCustomDist("");
    }
  }

  function removeDistance(d) {
    setDistances(distances.filter(function(v) { return v !== d; }));
  }

  function handleCustomKeyDown(e) {
    if (e.key === "Enter") addCustomDistance();
  }

  /* Compute scenario grid */
  var timeWindows = [
    { label: "Early Exit", sub: "Day " + earlyDays + " \u2014 " + (dte - earlyDays) + " DTE left", daysLeft: dte - earlyDays, color: COLORS.positive },
    { label: "On Time", sub: "Day " + onTimeDays + " \u2014 " + (dte - onTimeDays) + " DTE left", daysLeft: dte - onTimeDays, color: COLORS.warning },
    { label: "Near Expiry", sub: "Day " + nearExpiryDays + " \u2014 0 DTE left", daysLeft: 0, color: COLORS.negative },
  ];

  return (
    <div style={{
      background: COLORS.surfaceAlt,
      borderTop: "1px solid " + COLORS.accent + "33",
      borderBottom: "1px solid " + COLORS.accent + "33",
      borderLeft: "1px solid " + COLORS.border,
      borderRight: "1px solid " + COLORS.border,
      borderRadius: "0 0 12px 12px",
      marginTop: -10,
      marginBottom: 10,
      padding: "20px 22px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: FONTS.sans, fontSize: 12, fontWeight: 600,
            color: COLORS.accent, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Estimate</span>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 13, fontWeight: 500, color: COLORS.textPrimary,
          }}>{formatMoney(contract.strike) + " " + (contract.contractType === "call" ? "C" : "P") + " · " + formatDate(contract.expiry)}</span>
        </div>
        <button onClick={onClose} style={{
          fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textTertiary,
          background: "transparent", border: "1px solid " + COLORS.border,
          borderRadius: 6, padding: "4px 10px", cursor: "pointer",
        }}>Close</button>
      </div>

      {/* Inputs row */}
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap",
        marginBottom: 18, paddingBottom: 16,
        borderBottom: "1px solid " + COLORS.border,
      }}>
        {/* Investment amount */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <label style={{
              fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>Investment</label>
            <InfoTip text={numContracts > 0
              ? numContracts + " contract" + (numContracts > 1 ? "s" : "") + " \u00B7 " + formatMoney(actualCost) + " actual cost"
              : "Min " + formatMoney(premium * 100) + " for 1 contract"
            } />
          </div>
          <div style={{
            display: "flex", alignItems: "center",
            background: COLORS.surface, border: "1px solid " + COLORS.border,
            borderRadius: 6, overflow: "hidden",
          }}>
            <span style={{
              fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textTertiary,
              padding: "0 0 0 10px",
            }}>$</span>
            <input
              type="number" step="100" min="0"
              value={purchaseAmount}
              onChange={function(e) { setPurchaseAmount(parseInt(e.target.value, 10) || 0); }}
              style={{
                fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary,
                background: "transparent", border: "none", outline: "none",
                padding: "7px 10px 7px 4px", width: 90,
              }}
            />
          </div>
        </div>

        {/* Distance chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{
            fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Distance from Strike ($)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            {distances.slice().sort(function(a,b){ return a-b; }).map(function(d) {
              return (
                <div key={d} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textPrimary,
                  background: COLORS.surface, border: "1px solid " + COLORS.border,
                  borderRadius: 6, padding: "5px 8px",
                }}>
                  {"$" + d}
                  <button onClick={function() { removeDistance(d); }} style={{
                    fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
                    background: "transparent", border: "none", cursor: "pointer",
                    padding: "0 1px", lineHeight: 1,
                  }}>{"×"}</button>
                </div>
              );
            })}
            <div style={{
              display: "flex", alignItems: "center",
              background: COLORS.surface, border: "1px solid " + COLORS.border,
              borderRadius: 6, overflow: "hidden",
            }}>
              <span style={{
                fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textTertiary,
                padding: "0 0 0 8px",
              }}>+$</span>
              <input
                type="number" min="1" placeholder="custom"
                value={customDist}
                onChange={function(e) { setCustomDist(e.target.value); }}
                onKeyDown={handleCustomKeyDown}
                style={{
                  fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textPrimary,
                  background: "transparent", border: "none", outline: "none",
                  padding: "5px 8px 5px 4px", width: 55,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results table */}
      {showResults && numContracts > 0 ? (
        <div>
          {/* Legend */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16, marginBottom: 12,
          }}>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>{"If target price hits \u2014 estimated option value + total return on " + formatMoney(actualCost) + " invested"}</span>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontFamily: FONTS.mono, fontSize: 11,
            }}>
              <thead>
                <tr>
                  <th style={{
                    textAlign: "left", padding: "8px 12px",
                    fontFamily: FONTS.sans, fontSize: 10, fontWeight: 600,
                    color: COLORS.textTertiary, textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    borderBottom: "1px solid " + COLORS.border,
                    background: COLORS.surface,
                    borderRadius: "6px 0 0 0",
                    position: "sticky", left: 0,
                  }}>
                    Ticker Price
                  </th>
                  {timeWindows.map(function(tw, ti) {
                    return (
                      <th key={ti} style={{
                        textAlign: "center", padding: "8px 12px",
                        fontFamily: FONTS.sans, fontSize: 10, fontWeight: 600,
                        color: tw.color,
                        textTransform: "uppercase", letterSpacing: "0.06em",
                        borderBottom: "1px solid " + COLORS.border,
                        background: COLORS.surface,
                        borderRadius: ti === 2 ? "0 6px 0 0" : 0,
                        minWidth: 140,
                      }}>
                        <div>{tw.label}</div>
                        <div style={{
                          fontFamily: FONTS.sans, fontSize: 9, fontWeight: 400,
                          color: COLORS.textTertiary, marginTop: 2,
                          textTransform: "none", letterSpacing: "0",
                        }}>{tw.sub}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {priceRows.map(function(row, ri) {
                  var isStrike = row.side === "ATM";
                  var rowBg = isStrike ? COLORS.accentDim : (ri % 2 === 0 ? "transparent" : COLORS.surface + "44");

                  return (
                    <tr key={ri}>
                      {/* Price label */}
                      <td style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid " + COLORS.border + "66",
                        background: rowBg,
                        position: "sticky", left: 0,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontFamily: FONTS.mono, fontSize: 12, fontWeight: isStrike ? 600 : 400,
                            color: isStrike ? COLORS.accent : COLORS.textPrimary,
                          }}>{formatMoney(row.price)}</span>
                          <span style={{
                            fontFamily: FONTS.sans, fontSize: 9, fontWeight: 500,
                            color: row.side === "ITM" ? COLORS.positive : row.side === "OTM" ? COLORS.warning : COLORS.accent,
                            background: row.side === "ITM" ? COLORS.positiveDim : row.side === "OTM" ? COLORS.warningDim : COLORS.accentDim,
                            padding: "1px 5px", borderRadius: 3,
                          }}>{row.side}</span>
                          <span style={{
                            fontFamily: FONTS.sans, fontSize: 9,
                            color: COLORS.textTertiary,
                          }}>{row.label}</span>
                        </div>
                      </td>

                      {/* Time columns */}
                      {timeWindows.map(function(tw, ti) {
                        var optPrice = estimateOptionPrice(
                          row.price, contract.strike, tw.daysLeft,
                          contract.contractType, 0.25
                        );
                        var totalValue = optPrice * numContracts * 100;
                        var pnl = totalValue - actualCost;
                        var roi = actualCost > 0 ? (pnl / actualCost) * 100 : 0;
                        var isProfit = pnl >= 0;

                        return (
                          <td key={ti} style={{
                            padding: "8px 12px",
                            textAlign: "center",
                            borderBottom: "1px solid " + COLORS.border + "66",
                            background: rowBg,
                          }}>
                            <div style={{
                              fontFamily: FONTS.mono, fontSize: 12, fontWeight: 500,
                              color: COLORS.textPrimary, marginBottom: 2,
                            }}>{formatMoney(optPrice)}</div>
                            <div style={{
                              fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
                              color: isProfit ? COLORS.positive : COLORS.negative,
                            }}>{formatPct(roi)}</div>
                            <div style={{
                              fontFamily: FONTS.mono, fontSize: 9,
                              color: isProfit ? COLORS.positive + "99" : COLORS.negative + "99",
                              marginTop: 1,
                            }}>{(isProfit ? "+" : "") + formatMoney(pnl)}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer legend */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16, marginTop: 10,
            flexWrap: "wrap",
          }}>
            <span style={{ fontFamily: FONTS.sans, fontSize: 9, color: COLORS.textTertiary }}>
              {"Based on " + numContracts + " contract" + (numContracts > 1 ? "s" : "") + " (" + formatMoney(actualCost) + " invested) \u00B7 Early = halfway to projected \u00B7 On Time = projected date \u00B7 Near Expiry = at contract expiry"}
            </span>
            <span style={{
              fontFamily: FONTS.sans, fontSize: 9,
              color: COLORS.warning, fontStyle: "italic",
            }}>
              Simplified Black-Scholes estimate — actual prices will vary
            </span>
          </div>
        </div>
      ) : numContracts === 0 ? (
        <div style={{
          textAlign: "center", padding: "20px",
          fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textTertiary,
        }}>
          {"Enter at least " + formatMoney(premium * 100) + " to purchase 1 contract"}
        </div>
      ) : null}
    </div>
  );
}

/* ── Shared Components (unchanged from v2) ─────────────────────── */

function TickerSelector(props) {
  var selected = props.selected;
  var tickers = props.tickers;
  var customTickers = props.customTickers;
  var inputValue = props.inputValue;

  function handleKeyDown(e) {
    if (e.key === "Enter" && inputValue.trim().length > 0) {
      props.onAddCustom(inputValue.trim().toUpperCase());
    }
  }

  return (
    <div style={{
      background: COLORS.surface, border: "1px solid " + COLORS.border,
      borderRadius: 12, padding: "16px 20px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{
          fontFamily: FONTS.sans, fontSize: 11, fontWeight: 600,
          color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: "0.06em",
        }}>Select Ticker</span>
        <div style={{ flex: 1, height: 1, background: COLORS.border }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
          textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2,
        }}>Coach recs</span>
        {tickers.map(function(ticker) {
          var isActive = selected === ticker;
          var t = MOCK_TRADES[ticker];
          var dirColor = t.direction === "LONG" ? COLORS.positive : COLORS.negative;
          return (
            <button key={ticker} onClick={function() { props.onSelect(ticker); }} style={{
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: FONTS.mono, fontSize: 13, fontWeight: isActive ? 700 : 500,
              color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
              background: isActive ? COLORS.accentDim : "transparent",
              border: "1px solid " + (isActive ? COLORS.accent + "55" : COLORS.border),
              borderRadius: 8, padding: "7px 14px", cursor: "pointer",
              transition: "all 0.15s ease",
            }}>
              {ticker}
              <span style={{ fontFamily: FONTS.sans, fontSize: 8, fontWeight: 600, color: dirColor, textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8 }}>
                {t.direction === "LONG" ? "\u25B2" : "\u25BC"}
              </span>
            </button>
          );
        })}
        {customTickers.map(function(ticker) {
          var isActive = selected === ticker;
          return (
            <div key={ticker} style={{ position: "relative", display: "inline-flex" }}>
              <button onClick={function() { props.onSelect(ticker); }} style={{
                fontFamily: FONTS.mono, fontSize: 13, fontWeight: isActive ? 700 : 500,
                color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
                background: isActive ? COLORS.accentDim : "transparent",
                border: "1px dashed " + (isActive ? COLORS.accent + "55" : COLORS.borderLight),
                borderRadius: 8, padding: "7px 28px 7px 14px", cursor: "pointer",
                transition: "all 0.15s ease",
              }}>{ticker}</button>
              <button onClick={function() { props.onRemoveCustom(ticker); }} style={{
                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textTertiary,
                background: "transparent", border: "none", cursor: "pointer",
                padding: "0 2px", lineHeight: 1,
              }}>{"×"}</button>
            </div>
          );
        })}
        <div style={{ width: 1, height: 24, background: COLORS.borderLight, marginLeft: 4, marginRight: 4 }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border,
          borderRadius: 8, overflow: "hidden",
        }}>
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textTertiary, padding: "0 0 0 10px" }}>+</span>
          <input type="text" placeholder="Add ticker" value={inputValue}
            onChange={function(e) { props.onInputChange(e.target.value); }}
            onKeyDown={handleKeyDown} maxLength={5}
            style={{
              fontFamily: FONTS.mono, fontSize: 12, color: COLORS.textPrimary,
              background: "transparent", border: "none", outline: "none",
              padding: "7px 10px 7px 6px", width: 80, textTransform: "uppercase",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TradeContextBar(props) {
  var t = props.trade;
  var dirColor = t.direction === "LONG" ? COLORS.positive : COLORS.negative;
  var dirBg = t.direction === "LONG" ? COLORS.positiveDim : COLORS.negativeDim;
  var daysLeft = daysUntil(t.projectedDate);
  return (
    <div style={{
      background: COLORS.surface, border: "1px solid " + COLORS.border,
      borderRadius: 12, padding: "20px 24px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 28, fontWeight: 700, color: COLORS.textPrimary, letterSpacing: "-0.02em" }}>{t.ticker}</span>
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: dirColor, background: dirBg, padding: "4px 10px", borderRadius: 6, textTransform: "uppercase" }}>{t.direction}</span>
          {t.hasCoachRec ? (
            <span style={{ fontFamily: FONTS.sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: COLORS.accent, background: COLORS.accentDim, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>Coach Rec</span>
          ) : (
            <span style={{ fontFamily: FONTS.sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: COLORS.warning, background: COLORS.warningDim, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>Custom</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <MetricPill label="Current" value={formatMoney(t.currentPrice)} />
          <MetricPill label="Target" value={formatMoney(t.priceTargetHigh)} accent={true} />
          <MetricPill label="Stop" value={formatMoney(t.stopLoss)} negative={true} />
          <MetricPill label="Projected" value={formatDate(t.projectedDate)} sub={daysLeft + "d away"} />
        </div>
      </div>
      {t.coachNote ? (
        <div style={{ marginTop: 14, padding: "10px 14px", background: COLORS.surfaceAlt, borderRadius: 8, borderLeft: "3px solid " + (t.hasCoachRec ? COLORS.accent : COLORS.warning) }}>
          <span style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 1.5 }}>{t.coachNote}</span>
        </div>
      ) : null}
    </div>
  );
}

function MetricPill(props) {
  var valColor = COLORS.textPrimary;
  if (props.accent) valColor = COLORS.accent;
  if (props.negative) valColor = COLORS.negative;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: FONTS.sans, fontSize: 10, fontWeight: 500, color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>{props.label}</span>
      <span style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 500, color: valColor }}>{props.value}</span>
      {props.sub ? <span style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary }}>{props.sub}</span> : null}
    </div>
  );
}

function FilterBar(props) {
  var active = props.sortBy;
  function SortBtn(btnProps) {
    var isActive = active === btnProps.value;
    return (
      <button onClick={function() { props.onSort(btnProps.value); }} style={{
        fontFamily: FONTS.sans, fontSize: 12, fontWeight: isActive ? 600 : 400,
        color: isActive ? COLORS.accent : COLORS.textSecondary,
        background: isActive ? COLORS.accentDim : "transparent",
        border: "1px solid " + (isActive ? COLORS.accent + "44" : COLORS.border),
        borderRadius: 8, padding: "6px 14px", cursor: "pointer", transition: "all 0.15s ease",
      }}>{btnProps.label}</button>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: FONTS.sans, fontSize: 11, color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 6 }}>Sort by</span>
        <SortBtn label="ROI" value="roi" />
        <SortBtn label="Premium" value="premium" />
        <SortBtn label="Expiry" value="expiry" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 11, color: COLORS.textTertiary }}>{props.count} contracts</span>
        <span style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, background: COLORS.surfaceAlt, padding: "3px 8px", borderRadius: 4 }}>{props.contractLabel + " \u00B7 OI > 50 \u00B7 Spread < 20%"}</span>
      </div>
    </div>
  );
}

function ContractCard(props) {
  var c = props.contract;
  var rank = props.rank;
  var isBest = c.isSweetSpot;
  var isEstimating = props.isEstimating;
  var borderColor = isEstimating ? COLORS.accent + "66" : isBest ? COLORS.sweetSpotBorder : COLORS.border;
  var bgColor = isBest ? COLORS.sweetSpotDim : COLORS.surface;
  var roiColor = c.roi >= 0 ? COLORS.positive : COLORS.negative;
  var typeLabel = c.contractType === "call" ? "C" : "P";

  return (
    <div style={{
      background: bgColor,
      border: "1px solid " + borderColor,
      borderRadius: isEstimating ? "12px 12px 0 0" : 12,
      padding: "18px 22px",
      marginBottom: isEstimating ? 0 : 10,
      position: "relative",
      transition: "border-color 0.15s ease",
    }}>
      {isBest ? (
        <div style={{
          position: "absolute", top: -1, right: 20,
          background: COLORS.sweetSpot, color: "#0B0D11",
          fontFamily: FONTS.sans, fontSize: 9.5, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "3px 10px 4px", borderRadius: "0 0 6px 6px",
        }}>Sweet Spot</div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 600, color: isBest ? COLORS.sweetSpot : COLORS.textTertiary, width: 20, textAlign: "center", flexShrink: 0 }}>{"#" + rank}</div>
        <div style={{ minWidth: 90, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 600, color: COLORS.textPrimary }}>{formatMoney(c.strike)}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 500, color: COLORS.textTertiary }}>{typeLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ fontFamily: FONTS.sans, fontSize: 10, fontWeight: 500, color: c.moneyness === "OTM" ? COLORS.warning : COLORS.positive, background: c.moneyness === "OTM" ? COLORS.warningDim : COLORS.positiveDim, padding: "2px 6px", borderRadius: 4 }}>{c.moneyness}</span>
            <span style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary }}>strike</span>
          </div>
        </div>
        <div style={{ width: 1, height: 36, background: COLORS.borderLight, flexShrink: 0 }} />
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary }}>{formatDate(c.expiry)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>{c.dte + " DTE"}</div>
        </div>
        <div style={{ width: 1, height: 36, background: COLORS.borderLight, flexShrink: 0 }} />
        <div style={{ minWidth: 70, flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary }}>{formatMoney(c.ask)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>{"ask \u00B7 " + c.spread.toFixed(1) + "% spread"}</div>
        </div>
        <div style={{ width: 1, height: 36, background: COLORS.borderLight, flexShrink: 0 }} />
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.positive }}>{formatMoney(c.estValue)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>est. at target</div>
        </div>
        <div style={{ width: 1, height: 36, background: COLORS.borderLight, flexShrink: 0 }} />
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textSecondary }}>{formatMoney(c.breakeven)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>break-even</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700, color: roiColor, letterSpacing: "-0.02em" }}>{formatPct(c.roi)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 1 }}>intrinsic ROI</div>
        </div>
      </div>
      {/* OI bar + Estimate button */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, flexShrink: 0 }}>OI</span>
        <div style={{ flex: 1, height: 3, background: COLORS.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: Math.min(100, (c.openInterest / 22000) * 100) + "%",
            background: isBest ? COLORS.sweetSpot + "55" : COLORS.accent + "44",
            borderRadius: 2, transition: "width 0.4s ease",
          }} />
        </div>
        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textTertiary, flexShrink: 0 }}>{c.openInterest.toLocaleString()}</span>
        <div style={{ width: 1, height: 12, background: COLORS.borderLight, marginLeft: 4, marginRight: 4 }} />
        <button onClick={props.onEstimate} style={{
          fontFamily: FONTS.sans, fontSize: 10, fontWeight: 600,
          color: isEstimating ? COLORS.accent : COLORS.textSecondary,
          background: isEstimating ? COLORS.accentDim : "transparent",
          border: "1px solid " + (isEstimating ? COLORS.accent + "44" : COLORS.border),
          borderRadius: 5, padding: "3px 10px", cursor: "pointer",
          transition: "all 0.15s ease",
        }}>{isEstimating ? "Estimating..." : "Estimate"}</button>
      </div>
    </div>
  );
}

function SummaryFooter(props) {
  var best = props.contracts[0];
  if (!best) return null;
  var typeLabel = best.contractType === "call" ? "C" : "P";
  return (
    <div style={{
      marginTop: 20, padding: "16px 20px", background: COLORS.surfaceAlt,
      border: "1px solid " + COLORS.border, borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 12,
    }}>
      <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
        <span style={{ color: COLORS.textTertiary }}>Best contract: </span>
        <span style={{ color: COLORS.textPrimary, fontFamily: FONTS.mono, fontWeight: 500 }}>{formatMoney(best.strike) + " " + typeLabel}</span>
        <span style={{ color: COLORS.textTertiary }}>{" \u00B7 " + formatDate(best.expiry) + " \u00B7 "}</span>
        <span style={{ color: COLORS.positive, fontFamily: FONTS.mono, fontWeight: 600 }}>{formatPct(best.roi) + " ROI"}</span>
        <span style={{ color: COLORS.textTertiary }}>{" for " + formatMoney(best.ask) + "/contract"}</span>
      </div>
      <button style={{
        fontFamily: FONTS.sans, fontSize: 12, fontWeight: 600, color: "#0B0D11",
        background: COLORS.accent, border: "none", borderRadius: 8,
        padding: "8px 20px", cursor: "pointer", letterSpacing: "0.01em",
      }}>Open in WeBull</button>
    </div>
  );
}

function CustomTickerForm(props) {
  var ticker = props.ticker;
  var draft = props.draft;
  function handleChange(field, value) {
    var updated = Object.assign({}, draft);
    updated[field] = value;
    props.onUpdate(updated);
  }
  var isReady = draft.currentPrice > 0 && draft.priceTargetHigh > 0 && draft.projectedDate.length > 0;
  return (
    <div style={{ background: COLORS.surface, border: "1px dashed " + COLORS.warning + "44", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700, color: COLORS.textPrimary }}>{ticker}</span>
        <span style={{ fontFamily: FONTS.sans, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", color: COLORS.warning, background: COLORS.warningDim, padding: "3px 8px", borderRadius: 4, textTransform: "uppercase" }}>{"Custom \u2014 enter trade details"}</span>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Direction</label>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={function() { handleChange("direction", "LONG"); }} style={{
              fontFamily: FONTS.sans, fontSize: 11, fontWeight: 600,
              color: draft.direction === "LONG" ? COLORS.positive : COLORS.textTertiary,
              background: draft.direction === "LONG" ? COLORS.positiveDim : "transparent",
              border: "1px solid " + (draft.direction === "LONG" ? COLORS.positive + "44" : COLORS.border),
              borderRadius: 6, padding: "6px 12px", cursor: "pointer",
            }}>Long</button>
            <button onClick={function() { handleChange("direction", "SHORT"); }} style={{
              fontFamily: FONTS.sans, fontSize: 11, fontWeight: 600,
              color: draft.direction === "SHORT" ? COLORS.negative : COLORS.textTertiary,
              background: draft.direction === "SHORT" ? COLORS.negativeDim : "transparent",
              border: "1px solid " + (draft.direction === "SHORT" ? COLORS.negative + "44" : COLORS.border),
              borderRadius: 6, padding: "6px 12px", cursor: "pointer",
            }}>Short</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current Price</label>
          <input type="number" step="0.01" placeholder="0.00"
            value={draft.currentPrice > 0 ? draft.currentPrice : ""}
            onChange={function(e) { handleChange("currentPrice", parseFloat(e.target.value) || 0); }}
            style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary, background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border, borderRadius: 6, padding: "6px 10px", width: 100, outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Target Price</label>
          <input type="number" step="0.01" placeholder="0.00"
            value={draft.priceTargetHigh > 0 ? draft.priceTargetHigh : ""}
            onChange={function(e) { handleChange("priceTargetHigh", parseFloat(e.target.value) || 0); }}
            style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.accent, background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border, borderRadius: 6, padding: "6px 10px", width: 100, outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Stop Loss</label>
          <input type="number" step="0.01" placeholder="0.00"
            value={draft.stopLoss > 0 ? draft.stopLoss : ""}
            onChange={function(e) { handleChange("stopLoss", parseFloat(e.target.value) || 0); }}
            style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.negative, background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border, borderRadius: 6, padding: "6px 10px", width: 100, outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>Projected Date</label>
          <input type="date" value={draft.projectedDate}
            onChange={function(e) { handleChange("projectedDate", e.target.value); }}
            style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary, background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border, borderRadius: 6, padding: "6px 10px", outline: "none", colorScheme: "dark" }}
          />
        </div>
        <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: isReady ? COLORS.positive : COLORS.textTertiary, padding: "8px 0" }}>
          {isReady ? "\u2713 Ready \u2014 mock chain will display" : "Fill required fields to see contracts"}
        </div>
      </div>
    </div>
  );
}

function EmptyState(props) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 }}>{props.message || "No contracts match filters"}</div>
      <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textTertiary }}>{props.sub || "Try adjusting expiry range or OI thresholds"}</div>
    </div>
  );
}

/* ── Custom ticker placeholder chain ──────────────────────────── */
function makeDefaultCustomDraft(ticker) {
  return { ticker: ticker, direction: "LONG", currentPrice: 0, priceTargetHigh: 0, projectedDate: "", stopLoss: 0, coachNote: "", hasCoachRec: false };
}

function generatePlaceholderChain(trade) {
  if (trade.currentPrice <= 0 || trade.priceTargetHigh <= 0) return [];
  var isLong = trade.direction === "LONG";
  var cp = trade.currentPrice;
  var tp = trade.priceTargetHigh;
  var type = isLong ? "call" : "put";
  var step = Math.max(1, Math.round(Math.abs(tp - cp) / 4));
  var strikes = [];
  if (isLong) {
    strikes = [Math.round(cp - step), Math.round(cp), Math.round(cp + step), Math.round(cp + step * 2), Math.round(cp + step * 3)];
  } else {
    strikes = [Math.round(cp + step), Math.round(cp), Math.round(cp - step), Math.round(cp - step * 2), Math.round(cp - step * 3)];
  }
  var contracts = [];
  var idx = 0;
  strikes.forEach(function(s) {
    var dist = Math.abs(s - cp) / cp;
    var prem = Math.max(0.5, cp * 0.015 * (1 - dist * 2));
    prem = Math.round(prem * 100) / 100;
    contracts.push({
      id: trade.ticker + "-" + idx + "a", strike: s,
      expiry: idx < 3 ? "2026-05-08" : "2026-05-22",
      ask: prem, bid: Math.round((prem * 0.96) * 100) / 100,
      openInterest: Math.round(5000 + Math.random() * 10000),
      contractType: type, isSweetSpot: idx === 2,
    });
    idx = idx + 1;
  });
  return contracts;
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function OptionsFinder() {
  var coachTickers = Object.keys(MOCK_TRADES);
  var [selectedTicker, setSelectedTicker] = useState("SPY");
  var [sortBy, setSortBy] = useState("roi");
  var [customTickers, setCustomTickers] = useState([]);
  var [customDrafts, setCustomDrafts] = useState({});
  var [tickerInput, setTickerInput] = useState("");
  var [estimatingId, setEstimatingId] = useState(null);

  function handleAddCustom(ticker) {
    if (MOCK_TRADES[ticker]) { setSelectedTicker(ticker); setTickerInput(""); return; }
    if (customTickers.indexOf(ticker) >= 0) { setSelectedTicker(ticker); setTickerInput(""); return; }
    setCustomTickers(customTickers.concat([ticker]));
    var nd = Object.assign({}, customDrafts);
    nd[ticker] = makeDefaultCustomDraft(ticker);
    setCustomDrafts(nd);
    setSelectedTicker(ticker);
    setTickerInput("");
  }
  function handleRemoveCustom(ticker) {
    setCustomTickers(customTickers.filter(function(t) { return t !== ticker; }));
    var nd = Object.assign({}, customDrafts);
    delete nd[ticker];
    setCustomDrafts(nd);
    if (selectedTicker === ticker) setSelectedTicker(coachTickers[0]);
  }
  function handleUpdateDraft(updated) {
    var nd = Object.assign({}, customDrafts);
    nd[updated.ticker] = updated;
    setCustomDrafts(nd);
  }

  var isCoachRec = coachTickers.indexOf(selectedTicker) >= 0;
  var currentTrade = isCoachRec ? MOCK_TRADES[selectedTicker] : (customDrafts[selectedTicker] || makeDefaultCustomDraft(selectedTicker));
  var currentContracts = isCoachRec ? (MOCK_CHAINS[selectedTicker] || []) : generatePlaceholderChain(currentTrade);
  var enriched = currentContracts.length > 0 && currentTrade.currentPrice > 0 && currentTrade.priceTargetHigh > 0
    ? enrichContracts(currentContracts, currentTrade) : [];
  var sorted = enriched.slice();
  if (sortBy === "premium") { sorted.sort(function(a, b) { return a.ask - b.ask; }); }
  else if (sortBy === "expiry") { sorted.sort(function(a, b) { return a.dte - b.dte; }); }
  var contractLabel = currentTrade.direction === "LONG" ? "Calls only" : "Puts only";

  /* Reset estimate when switching tickers */
  function handleSelectTicker(ticker) {
    setSelectedTicker(ticker);
    setEstimatingId(null);
  }

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, fontFamily: FONTS.sans,
      padding: "28px 32px", maxWidth: 960, margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.accent, boxShadow: "0 0 8px " + COLORS.accent + "66" }} />
            <h1 style={{ fontFamily: FONTS.sans, fontSize: 18, fontWeight: 600, color: COLORS.textPrimary, margin: 0, letterSpacing: "-0.01em" }}>Options Finder</h1>
          </div>
          <p style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textTertiary, margin: "6px 0 0 18px" }}>{"Phase 1 \u2014 Intrinsic value ROI ranking"}</p>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textTertiary, background: COLORS.surfaceAlt, padding: "5px 10px", borderRadius: 6, border: "1px solid " + COLORS.border }}>
          <span style={{ color: COLORS.positive }}>{"\u25CF"}</span>{" Mock data \u00B7 Mar 25, 2026"}
        </div>
      </div>

      <TickerSelector
        selected={selectedTicker} tickers={coachTickers} customTickers={customTickers}
        inputValue={tickerInput} onSelect={handleSelectTicker} onInputChange={setTickerInput}
        onAddCustom={handleAddCustom} onRemoveCustom={handleRemoveCustom}
      />

      {!isCoachRec ? <CustomTickerForm ticker={selectedTicker} draft={currentTrade} onUpdate={handleUpdateDraft} /> : null}
      {isCoachRec ? <TradeContextBar trade={currentTrade} /> : null}

      {sorted.length > 0 ? (
        <div>
          <FilterBar sortBy={sortBy} onSort={setSortBy} count={sorted.length} contractLabel={contractLabel} />
          {sorted.map(function(contract, i) {
            var isEst = estimatingId === contract.id;
            return (
              <div key={contract.id}>
                <ContractCard
                  contract={contract} rank={i + 1}
                  isEstimating={isEst}
                  onEstimate={function() { setEstimatingId(isEst ? null : contract.id); }}
                />
                {isEst ? (
                  <EstimatePanel
                    contract={contract}
                    trade={currentTrade}
                    onClose={function() { setEstimatingId(null); }}
                  />
                ) : null}
              </div>
            );
          })}
          <SummaryFooter contracts={sorted} />
        </div>
      ) : (
        <EmptyState
          message={!isCoachRec && currentTrade.currentPrice <= 0 ? "Enter trade details above to see contracts" : "No contracts match filters"}
          sub={!isCoachRec && currentTrade.currentPrice <= 0 ? "Current price, target, and projected date are required" : "Try adjusting expiry range or OI thresholds"}
        />
      )}

      <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 8, background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border }}>
        <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, lineHeight: 1.6 }}>
          <span style={{ fontWeight: 600, color: COLORS.textSecondary }}>Phase 1 methodology: </span>
          {"ROI is calculated using intrinsic value only \u2014 max(0, target\u2212strike) minus premium, divided by premium. Estimate panel uses simplified Black-Scholes pricing to model time decay across 3 windows. Does not account for IV changes or real market conditions. Contracts filtered to calls (long) or puts (short), expiry \u226514 days past projected date, OI > 50, bid-ask spread < 20%."}
          <span style={{ color: COLORS.accent }}>{" Phase 2 will add Delta, Theta, IV, and composite scoring."}</span>
        </div>
      </div>
    </div>
  );
}
