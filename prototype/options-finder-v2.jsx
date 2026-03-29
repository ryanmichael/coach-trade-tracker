import { useState } from "react";

/* ───────────────────────────────────────────────────────────────
   Options Finder v2 — Phase 1: Basic ROI Ranking
   + Ticker selection & custom ticker input
   Mercury Dark Mode Design System
   ─────────────────────────────────────────────────────────────── */

const COLORS = {
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

const FONTS = {
  sans: "'DM Sans', system-ui, sans-serif",
  mono: "'DM Mono', 'SF Mono', monospace",
};

/* ── Mock ParsedTrades (coach recs) ───────────────────────────── */
var MOCK_TRADES = {
  SPY: {
    ticker: "SPY",
    direction: "LONG",
    currentPrice: 561.42,
    priceTargetHigh: 582.00,
    projectedDate: "2026-04-18",
    stopLoss: 548.00,
    coachNote: "Wyckoff accumulation phase complete. Spring confirmed on daily chart. Targeting measured move to $582 by mid-April.",
    hasCoachRec: true,
  },
  AAPL: {
    ticker: "AAPL",
    direction: "LONG",
    currentPrice: 218.54,
    priceTargetHigh: 235.00,
    projectedDate: "2026-04-25",
    stopLoss: 210.00,
    coachNote: "Breakout from 3-month consolidation range. Volume confirming. Measured target $235 based on prior range height.",
    hasCoachRec: true,
  },
  TSLA: {
    ticker: "TSLA",
    direction: "SHORT",
    currentPrice: 274.80,
    priceTargetHigh: 245.00,
    projectedDate: "2026-04-11",
    stopLoss: 290.00,
    coachNote: "Distribution complete on weekly. Upthrust confirmed at $285 resistance. Expecting markdown phase to $245 support.",
    hasCoachRec: true,
  },
};

/* ── Mock Options Chains per ticker ───────────────────────────── */
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
  if (contractType === "call") {
    intrinsic = Math.max(0, targetPrice - strike);
  } else {
    intrinsic = Math.max(0, strike - targetPrice);
  }
  return ((intrinsic - ask) / ask) * 100;
}

function calcBreakeven(strike, ask, contractType) {
  if (contractType === "call") return strike + ask;
  return strike - ask;
}

function calcEstValue(strike, targetPrice, contractType) {
  if (contractType === "call") return Math.max(0, targetPrice - strike);
  return Math.max(0, strike - targetPrice);
}

function formatMoney(val) {
  return "$" + val.toFixed(2);
}

function formatPct(val) {
  var sign = val >= 0 ? "+" : "";
  return sign + val.toFixed(1) + "%";
}

function formatDate(dateStr) {
  var parts = dateStr.split("-");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return months[parseInt(parts[1], 10) - 1] + " " + parseInt(parts[2], 10);
}

function daysUntil(dateStr) {
  var target = new Date(dateStr);
  var now = new Date("2026-03-25");
  var diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function spreadPct(bid, ask) {
  var mid = (bid + ask) / 2;
  if (mid === 0) return 0;
  return ((ask - bid) / mid) * 100;
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

function enrichContracts(contracts, trade) {
  return contracts.map(function(c) {
    var roi = calcROI(c.strike, c.ask, trade.priceTargetHigh, c.contractType);
    var breakeven = calcBreakeven(c.strike, c.ask, c.contractType);
    var estValue = calcEstValue(c.strike, trade.priceTargetHigh, c.contractType);
    var spread = spreadPct(c.bid, c.ask);
    var dte = daysUntil(c.expiry);
    var mness = moneynessLabel(c.strike, trade.currentPrice, c.contractType);
    return Object.assign({}, c, {
      roi: roi,
      breakeven: breakeven,
      estValue: estValue,
      spread: spread,
      dte: dte,
      moneyness: mness,
    });
  }).sort(function(a, b) { return b.roi - a.roi; });
}

/* ── Components ────────────────────────────────────────────────── */

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
      background: COLORS.surface,
      border: "1px solid " + COLORS.border,
      borderRadius: 12,
      padding: "16px 20px",
      marginBottom: 20,
    }}>
      {/* Section label */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      }}>
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}>Select Ticker</span>
        <div style={{
          flex: 1,
          height: 1,
          background: COLORS.border,
        }} />
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}>
        {/* Coach rec tickers */}
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 10,
          color: COLORS.textTertiary,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginRight: 2,
        }}>Coach recs</span>

        {tickers.map(function(ticker) {
          var isActive = selected === ticker;
          var trade = MOCK_TRADES[ticker];
          var dirColor = trade.direction === "LONG" ? COLORS.positive : COLORS.negative;

          return (
            <button
              key={ticker}
              onClick={function() { props.onSelect(ticker); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: FONTS.mono,
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
                background: isActive ? COLORS.accentDim : "transparent",
                border: "1px solid " + (isActive ? COLORS.accent + "55" : COLORS.border),
                borderRadius: 8,
                padding: "7px 14px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {ticker}
              <span style={{
                fontFamily: FONTS.sans,
                fontSize: 8,
                fontWeight: 600,
                color: dirColor,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                opacity: 0.8,
              }}>{trade.direction === "LONG" ? "▲" : "▼"}</span>
            </button>
          );
        })}

        {/* Custom tickers */}
        {customTickers.map(function(ticker) {
          var isActive = selected === ticker;

          return (
            <div key={ticker} style={{ position: "relative", display: "inline-flex" }}>
              <button
                onClick={function() { props.onSelect(ticker); }}
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
                  background: isActive ? COLORS.accentDim : "transparent",
                  border: "1px dashed " + (isActive ? COLORS.accent + "55" : COLORS.borderLight),
                  borderRadius: 8,
                  padding: "7px 28px 7px 14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >{ticker}</button>
              <button
                onClick={function() { props.onRemoveCustom(ticker); }}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  color: COLORS.textTertiary,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0 2px",
                  lineHeight: 1,
                }}
              >×</button>
            </div>
          );
        })}

        {/* Divider */}
        <div style={{
          width: 1,
          height: 24,
          background: COLORS.borderLight,
          marginLeft: 4,
          marginRight: 4,
        }} />

        {/* Add custom ticker input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          background: COLORS.surfaceAlt,
          border: "1px solid " + COLORS.border,
          borderRadius: 8,
          overflow: "hidden",
        }}>
          <span style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: COLORS.textTertiary,
            padding: "0 0 0 10px",
          }}>+</span>
          <input
            type="text"
            placeholder="Add ticker"
            value={inputValue}
            onChange={function(e) { props.onInputChange(e.target.value); }}
            onKeyDown={handleKeyDown}
            maxLength={5}
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              color: COLORS.textPrimary,
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "7px 10px 7px 6px",
              width: 80,
              textTransform: "uppercase",
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
      background: COLORS.surface,
      border: "1px solid " + COLORS.border,
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 20,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{
            fontFamily: FONTS.mono,
            fontSize: 28,
            fontWeight: 700,
            color: COLORS.textPrimary,
            letterSpacing: "-0.02em",
          }}>{t.ticker}</span>
          <span style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: dirColor,
            background: dirBg,
            padding: "4px 10px",
            borderRadius: 6,
            textTransform: "uppercase",
          }}>{t.direction}</span>
          {t.hasCoachRec ? (
            <span style={{
              fontFamily: FONTS.sans,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: COLORS.accent,
              background: COLORS.accentDim,
              padding: "3px 8px",
              borderRadius: 4,
              textTransform: "uppercase",
            }}>Coach Rec</span>
          ) : (
            <span style={{
              fontFamily: FONTS.sans,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: COLORS.warning,
              background: COLORS.warningDim,
              padding: "3px 8px",
              borderRadius: 4,
              textTransform: "uppercase",
            }}>Custom</span>
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
        <div style={{
          marginTop: 14,
          padding: "10px 14px",
          background: COLORS.surfaceAlt,
          borderRadius: 8,
          borderLeft: "3px solid " + (t.hasCoachRec ? COLORS.accent : COLORS.warning),
        }}>
          <span style={{
            fontFamily: FONTS.sans,
            fontSize: 12.5,
            color: COLORS.textSecondary,
            lineHeight: 1.5,
          }}>{t.coachNote}</span>
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
      <span style={{
        fontFamily: FONTS.sans,
        fontSize: 10,
        fontWeight: 500,
        color: COLORS.textTertiary,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}>{props.label}</span>
      <span style={{
        fontFamily: FONTS.mono,
        fontSize: 14,
        fontWeight: 500,
        color: valColor,
      }}>{props.value}</span>
      {props.sub ? (
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 10,
          color: COLORS.textTertiary,
        }}>{props.sub}</span>
      ) : null}
    </div>
  );
}

function FilterBar(props) {
  var active = props.sortBy;

  function SortBtn(btnProps) {
    var isActive = active === btnProps.value;
    return (
      <button
        onClick={function() { props.onSort(btnProps.value); }}
        style={{
          fontFamily: FONTS.sans,
          fontSize: 12,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? COLORS.accent : COLORS.textSecondary,
          background: isActive ? COLORS.accentDim : "transparent",
          border: "1px solid " + (isActive ? COLORS.accent + "44" : COLORS.border),
          borderRadius: 8,
          padding: "6px 14px",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >{btnProps.label}</button>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
      flexWrap: "wrap",
      gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 11,
          color: COLORS.textTertiary,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginRight: 6,
        }}>Sort by</span>
        <SortBtn label="ROI" value="roi" />
        <SortBtn label="Premium" value="premium" />
        <SortBtn label="Expiry" value="expiry" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          color: COLORS.textTertiary,
        }}>{props.count} contracts</span>
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 10,
          color: COLORS.textTertiary,
          background: COLORS.surfaceAlt,
          padding: "3px 8px",
          borderRadius: 4,
        }}>{props.contractLabel + " · OI > 50 · Spread < 20%"}</span>
      </div>
    </div>
  );
}

function ContractCard(props) {
  var c = props.contract;
  var rank = props.rank;
  var isBest = c.isSweetSpot;

  var borderColor = isBest ? COLORS.sweetSpotBorder : COLORS.border;
  var bgColor = isBest ? COLORS.sweetSpotDim : COLORS.surface;
  var roiColor = c.roi >= 0 ? COLORS.positive : COLORS.negative;
  var typeLabel = c.contractType === "call" ? "C" : "P";

  return (
    <div style={{
      background: bgColor,
      border: "1px solid " + borderColor,
      borderRadius: 12,
      padding: "18px 22px",
      marginBottom: 10,
      position: "relative",
      transition: "border-color 0.15s ease",
    }}>
      {isBest ? (
        <div style={{
          position: "absolute",
          top: -1,
          right: 20,
          background: COLORS.sweetSpot,
          color: "#0B0D11",
          fontFamily: FONTS.sans,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "3px 10px 4px",
          borderRadius: "0 0 6px 6px",
        }}>Sweet Spot</div>
      ) : null}

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
      }}>
        {/* Rank */}
        <div style={{
          fontFamily: FONTS.mono,
          fontSize: 14,
          fontWeight: 600,
          color: isBest ? COLORS.sweetSpot : COLORS.textTertiary,
          width: 20,
          textAlign: "center",
          flexShrink: 0,
        }}>{"#" + rank}</div>

        {/* Strike + Moneyness */}
        <div style={{ minWidth: 90, flexShrink: 0 }}>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: 4,
          }}>
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 18,
              fontWeight: 600,
              color: COLORS.textPrimary,
            }}>{formatMoney(c.strike)}</span>
            <span style={{
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 500,
              color: COLORS.textTertiary,
            }}>{typeLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{
              fontFamily: FONTS.sans,
              fontSize: 10,
              fontWeight: 500,
              color: c.moneyness === "OTM" ? COLORS.warning : COLORS.positive,
              background: c.moneyness === "OTM" ? COLORS.warningDim : COLORS.positiveDim,
              padding: "2px 6px",
              borderRadius: 4,
            }}>{c.moneyness}</span>
            <span style={{
              fontFamily: FONTS.sans,
              fontSize: 10,
              color: COLORS.textTertiary,
            }}>strike</span>
          </div>
        </div>

        <div style={{ width: 1, height: 36, background: COLORS.borderLight, flexShrink: 0 }} />

        {/* Expiry + DTE */}
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary }}>{formatDate(c.expiry)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>{c.dte + " DTE"}</div>
        </div>

        <div style={{ width: 1, height: 36, background: COLORS.borderLight, flexShrink: 0 }} />

        {/* Premium */}
        <div style={{ minWidth: 70, flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary }}>{formatMoney(c.ask)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>{"ask · " + c.spread.toFixed(1) + "% spread"}</div>
        </div>

        <div style={{ width: 1, height: 36, background: COLORS.borderLight, flexShrink: 0 }} />

        {/* Est Value at Target */}
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.positive }}>{formatMoney(c.estValue)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>est. at target</div>
        </div>

        <div style={{ width: 1, height: 36, background: COLORS.borderLight, flexShrink: 0 }} />

        {/* Break-even */}
        <div style={{ minWidth: 80, flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textSecondary }}>{formatMoney(c.breakeven)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 2 }}>break-even</div>
        </div>

        {/* ROI */}
        <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontFamily: FONTS.mono,
            fontSize: 22,
            fontWeight: 700,
            color: roiColor,
            letterSpacing: "-0.02em",
          }}>{formatPct(c.roi)}</div>
          <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, marginTop: 1 }}>intrinsic ROI</div>
        </div>
      </div>

      {/* OI bar */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, flexShrink: 0 }}>OI</span>
        <div style={{ flex: 1, height: 3, background: COLORS.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: Math.min(100, (c.openInterest / 22000) * 100) + "%",
            background: isBest ? COLORS.sweetSpot + "55" : COLORS.accent + "44",
            borderRadius: 2,
            transition: "width 0.4s ease",
          }} />
        </div>
        <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textTertiary, flexShrink: 0 }}>{c.openInterest.toLocaleString()}</span>
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
      marginTop: 20,
      padding: "16px 20px",
      background: COLORS.surfaceAlt,
      border: "1px solid " + COLORS.border,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 12,
    }}>
      <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5 }}>
        <span style={{ color: COLORS.textTertiary }}>Best contract: </span>
        <span style={{ color: COLORS.textPrimary, fontFamily: FONTS.mono, fontWeight: 500 }}>
          {formatMoney(best.strike) + " " + typeLabel}
        </span>
        <span style={{ color: COLORS.textTertiary }}>{" · " + formatDate(best.expiry) + " · "}</span>
        <span style={{ color: COLORS.positive, fontFamily: FONTS.mono, fontWeight: 600 }}>
          {formatPct(best.roi) + " ROI"}
        </span>
        <span style={{ color: COLORS.textTertiary }}>{" for " + formatMoney(best.ask) + "/contract"}</span>
      </div>
      <button style={{
        fontFamily: FONTS.sans,
        fontSize: 12,
        fontWeight: 600,
        color: "#0B0D11",
        background: COLORS.accent,
        border: "none",
        borderRadius: 8,
        padding: "8px 20px",
        cursor: "pointer",
        letterSpacing: "0.01em",
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
    <div style={{
      background: COLORS.surface,
      border: "1px dashed " + COLORS.warning + "44",
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 20,
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
      }}>
        <span style={{
          fontFamily: FONTS.mono,
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.textPrimary,
        }}>{ticker}</span>
        <span style={{
          fontFamily: FONTS.sans,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.06em",
          color: COLORS.warning,
          background: COLORS.warningDim,
          padding: "3px 8px",
          borderRadius: 4,
          textTransform: "uppercase",
        }}>Custom — enter trade details</span>
      </div>

      <div style={{
        display: "flex",
        gap: 14,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}>
        {/* Direction */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{
            fontFamily: FONTS.sans,
            fontSize: 10,
            color: COLORS.textTertiary,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>Direction</label>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={function() { handleChange("direction", "LONG"); }}
              style={{
                fontFamily: FONTS.sans,
                fontSize: 11,
                fontWeight: 600,
                color: draft.direction === "LONG" ? COLORS.positive : COLORS.textTertiary,
                background: draft.direction === "LONG" ? COLORS.positiveDim : "transparent",
                border: "1px solid " + (draft.direction === "LONG" ? COLORS.positive + "44" : COLORS.border),
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >Long</button>
            <button
              onClick={function() { handleChange("direction", "SHORT"); }}
              style={{
                fontFamily: FONTS.sans,
                fontSize: 11,
                fontWeight: 600,
                color: draft.direction === "SHORT" ? COLORS.negative : COLORS.textTertiary,
                background: draft.direction === "SHORT" ? COLORS.negativeDim : "transparent",
                border: "1px solid " + (draft.direction === "SHORT" ? COLORS.negative + "44" : COLORS.border),
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >Short</button>
          </div>
        </div>

        {/* Current Price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{
            fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Current Price</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={draft.currentPrice > 0 ? draft.currentPrice : ""}
            onChange={function(e) { handleChange("currentPrice", parseFloat(e.target.value) || 0); }}
            style={{
              fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary,
              background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border,
              borderRadius: 6, padding: "6px 10px", width: 100, outline: "none",
            }}
          />
        </div>

        {/* Target Price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{
            fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Target Price</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={draft.priceTargetHigh > 0 ? draft.priceTargetHigh : ""}
            onChange={function(e) { handleChange("priceTargetHigh", parseFloat(e.target.value) || 0); }}
            style={{
              fontFamily: FONTS.mono, fontSize: 13, color: COLORS.accent,
              background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border,
              borderRadius: 6, padding: "6px 10px", width: 100, outline: "none",
            }}
          />
        </div>

        {/* Stop Loss */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{
            fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Stop Loss</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={draft.stopLoss > 0 ? draft.stopLoss : ""}
            onChange={function(e) { handleChange("stopLoss", parseFloat(e.target.value) || 0); }}
            style={{
              fontFamily: FONTS.mono, fontSize: 13, color: COLORS.negative,
              background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border,
              borderRadius: 6, padding: "6px 10px", width: 100, outline: "none",
            }}
          />
        </div>

        {/* Projected Date */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{
            fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>Projected Date</label>
          <input
            type="date"
            value={draft.projectedDate}
            onChange={function(e) { handleChange("projectedDate", e.target.value); }}
            style={{
              fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary,
              background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border,
              borderRadius: 6, padding: "6px 10px", outline: "none",
              colorScheme: "dark",
            }}
          />
        </div>

        {/* Status indicator */}
        <div style={{
          fontFamily: FONTS.sans,
          fontSize: 10,
          color: isReady ? COLORS.positive : COLORS.textTertiary,
          padding: "8px 0",
        }}>{isReady ? "✓ Ready — mock chain will display" : "Fill required fields to see contracts"}</div>
      </div>
    </div>
  );
}

function EmptyState(props) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontFamily: FONTS.sans, fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 }}>
        {props.message || "No contracts match filters"}
      </div>
      <div style={{ fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textTertiary }}>
        {props.sub || "Try adjusting expiry range or OI thresholds"}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

function makeDefaultCustomDraft(ticker) {
  return {
    ticker: ticker,
    direction: "LONG",
    currentPrice: 0,
    priceTargetHigh: 0,
    projectedDate: "",
    stopLoss: 0,
    coachNote: "",
    hasCoachRec: false,
  };
}

/* Generate placeholder contracts for custom tickers */
function generatePlaceholderChain(trade) {
  if (trade.currentPrice <= 0 || trade.priceTargetHigh <= 0) return [];
  var isLong = trade.direction === "LONG";
  var cp = trade.currentPrice;
  var tp = trade.priceTargetHigh;
  var type = isLong ? "call" : "put";
  var step = Math.max(1, Math.round((Math.abs(tp - cp) / 4)));

  var strikes = [];
  if (isLong) {
    strikes = [
      Math.round(cp - step),
      Math.round(cp),
      Math.round(cp + step),
      Math.round(cp + step * 2),
      Math.round(cp + step * 3),
    ];
  } else {
    strikes = [
      Math.round(cp + step),
      Math.round(cp),
      Math.round(cp - step),
      Math.round(cp - step * 2),
      Math.round(cp - step * 3),
    ];
  }

  var expiry1 = "2026-05-08";
  var expiry2 = "2026-05-22";

  var contracts = [];
  var idx = 0;
  strikes.forEach(function(s) {
    var dist = Math.abs(s - cp) / cp;
    var prem = Math.max(0.5, cp * 0.015 * (1 - dist * 2));
    prem = Math.round(prem * 100) / 100;
    var isSS = idx === 2;
    contracts.push({
      id: trade.ticker + "-" + idx + "a",
      strike: s,
      expiry: idx < 3 ? expiry1 : expiry2,
      ask: prem,
      bid: Math.round((prem * 0.96) * 100) / 100,
      openInterest: Math.round(5000 + Math.random() * 10000),
      contractType: type,
      isSweetSpot: isSS,
    });
    idx = idx + 1;
  });

  return contracts;
}

export default function OptionsFinder() {
  var coachTickers = Object.keys(MOCK_TRADES);

  var [selectedTicker, setSelectedTicker] = useState("SPY");
  var [sortBy, setSortBy] = useState("roi");
  var [customTickers, setCustomTickers] = useState([]);
  var [customDrafts, setCustomDrafts] = useState({});
  var [tickerInput, setTickerInput] = useState("");

  function handleAddCustom(ticker) {
    if (MOCK_TRADES[ticker]) {
      setSelectedTicker(ticker);
      setTickerInput("");
      return;
    }
    if (customTickers.indexOf(ticker) >= 0) {
      setSelectedTicker(ticker);
      setTickerInput("");
      return;
    }
    var newCustom = customTickers.concat([ticker]);
    setCustomTickers(newCustom);
    var newDrafts = Object.assign({}, customDrafts);
    newDrafts[ticker] = makeDefaultCustomDraft(ticker);
    setCustomDrafts(newDrafts);
    setSelectedTicker(ticker);
    setTickerInput("");
  }

  function handleRemoveCustom(ticker) {
    var filtered = customTickers.filter(function(t) { return t !== ticker; });
    setCustomTickers(filtered);
    var newDrafts = Object.assign({}, customDrafts);
    delete newDrafts[ticker];
    setCustomDrafts(newDrafts);
    if (selectedTicker === ticker) {
      setSelectedTicker(coachTickers[0]);
    }
  }

  function handleUpdateDraft(updated) {
    var newDrafts = Object.assign({}, customDrafts);
    newDrafts[updated.ticker] = updated;
    setCustomDrafts(newDrafts);
  }

  /* Resolve current trade + contracts */
  var isCoachRec = coachTickers.indexOf(selectedTicker) >= 0;
  var currentTrade = isCoachRec ? MOCK_TRADES[selectedTicker] : (customDrafts[selectedTicker] || makeDefaultCustomDraft(selectedTicker));
  var currentContracts = isCoachRec ? (MOCK_CHAINS[selectedTicker] || []) : generatePlaceholderChain(currentTrade);

  var enriched = currentContracts.length > 0 && currentTrade.currentPrice > 0 && currentTrade.priceTargetHigh > 0
    ? enrichContracts(currentContracts, currentTrade)
    : [];

  var sorted = enriched.slice();
  if (sortBy === "premium") {
    sorted.sort(function(a, b) { return a.ask - b.ask; });
  } else if (sortBy === "expiry") {
    sorted.sort(function(a, b) { return a.dte - b.dte; });
  }

  var contractLabel = currentTrade.direction === "LONG" ? "Calls only" : "Puts only";

  return (
    <div style={{
      minHeight: "100vh",
      background: COLORS.bg,
      fontFamily: FONTS.sans,
      padding: "28px 32px",
      maxWidth: 960,
      margin: "0 auto",
    }}>
      {/* Page header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: COLORS.accent,
              boxShadow: "0 0 8px " + COLORS.accent + "66",
            }} />
            <h1 style={{
              fontFamily: FONTS.sans, fontSize: 18, fontWeight: 600,
              color: COLORS.textPrimary, margin: 0, letterSpacing: "-0.01em",
            }}>Options Finder</h1>
          </div>
          <p style={{
            fontFamily: FONTS.sans, fontSize: 12, color: COLORS.textTertiary,
            margin: "6px 0 0 18px",
          }}>Phase 1 — Intrinsic value ROI ranking</p>
        </div>

        <div style={{
          fontFamily: FONTS.mono, fontSize: 10, color: COLORS.textTertiary,
          background: COLORS.surfaceAlt, padding: "5px 10px", borderRadius: 6,
          border: "1px solid " + COLORS.border,
        }}>
          <span style={{ color: COLORS.positive }}>{"●"}</span>
          {" Mock data · Mar 25, 2026"}
        </div>
      </div>

      {/* Ticker selector */}
      <TickerSelector
        selected={selectedTicker}
        tickers={coachTickers}
        customTickers={customTickers}
        inputValue={tickerInput}
        onSelect={setSelectedTicker}
        onInputChange={setTickerInput}
        onAddCustom={handleAddCustom}
        onRemoveCustom={handleRemoveCustom}
      />

      {/* Custom ticker form (only for non-coach tickers) */}
      {!isCoachRec ? (
        <CustomTickerForm
          ticker={selectedTicker}
          draft={currentTrade}
          onUpdate={handleUpdateDraft}
        />
      ) : null}

      {/* Trade context (only for coach recs or filled custom) */}
      {isCoachRec ? (
        <TradeContextBar trade={currentTrade} />
      ) : null}

      {/* Contracts section */}
      {sorted.length > 0 ? (
        <div>
          <FilterBar
            sortBy={sortBy}
            onSort={setSortBy}
            count={sorted.length}
            contractLabel={contractLabel}
          />

          {sorted.map(function(contract, i) {
            return (
              <ContractCard key={contract.id} contract={contract} rank={i + 1} />
            );
          })}

          <SummaryFooter contracts={sorted} />
        </div>
      ) : (
        <EmptyState
          message={!isCoachRec && currentTrade.currentPrice <= 0
            ? "Enter trade details above to see contracts"
            : "No contracts match filters"
          }
          sub={!isCoachRec && currentTrade.currentPrice <= 0
            ? "Current price, target, and projected date are required"
            : "Try adjusting expiry range or OI thresholds"
          }
        />
      )}

      {/* Methodology note */}
      <div style={{
        marginTop: 20, padding: "12px 16px", borderRadius: 8,
        background: COLORS.surfaceAlt, border: "1px solid " + COLORS.border,
      }}>
        <div style={{
          fontFamily: FONTS.sans, fontSize: 10, color: COLORS.textTertiary, lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600, color: COLORS.textSecondary }}>Phase 1 methodology: </span>
          {"ROI is calculated using intrinsic value only \u2014 max(0, target\u2212strike) minus premium, divided by premium. Does not account for remaining time value, Greeks, or IV. Contracts filtered to calls (long) or puts (short), expiry \u226514 days past projected date, OI > 50, bid-ask spread < 20%."}
          <span style={{ color: COLORS.accent }}>{" Phase 2 will add Delta, Theta, IV, and composite scoring."}</span>
        </div>
      </div>
    </div>
  );
}
