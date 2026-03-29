# Options ROI Estimator — PRD

**Version:** 0.1 | **Date:** 2026-03-25 | **Status:** Ideation

> Given a coach's trade recommendation, surface the best options contracts ranked by estimated ROI. Help the user pick the right strike and expiry without leaving Coachtrack.

---

## Context

The coach posts a trade rec: ticker, direction, target price, projected date. The user then opens WeBull to buy options — but choosing the right contract (strike + expiry) requires comparing dozens of candidates across multiple variables. This feature automates that analysis.

**Data source:** Polygon.io Options Chain Snapshot API
**Existing integration point:** ParsedTrade record (ticker, direction, priceTargetHigh/Low, projectedDate, stopLoss, priceConfirmation)

---

## Phase 1 — Basic ROI Ranking

**What it does:** For a given ParsedTrade, fetch the options chain and rank contracts by simple intrinsic-value ROI at the coach's target price.

**Core formula:**
```
Call ROI = (max(0, targetPrice - strike) - premium) / premium
Put ROI  = (max(0, strike - targetPrice) - premium) / premium
```

**Inputs from user/system:**
- Ticker, direction, target price, projected date (from ParsedTrade)
- Current stock price (from Polygon price API)

**Outputs per contract:**
- Strike price
- Expiration date
- Ask price (premium)
- Estimated value at target
- ROI %
- Break-even price

**Filters:**
- Contract type: calls for longs, puts for shorts
- Expiry: at least 14 days past projected date
- Open interest > 50
- Bid-ask spread < 20% of midpoint

**Display:** Top 5 contracts sorted by ROI, with the "sweet spot" highlighted (slightly OTM from current, well ITM at target).

---

## Phase 2 — Greeks Intelligence

**Adds:** Delta, theta, IV awareness. Composite scoring replaces pure ROI sort.

**New data per contract:**
- Delta (probability proxy + leverage indicator)
- Theta (daily time decay cost)
- Implied volatility
- Composite score (weighted rank)

**Filters tighten:**
- Delta: 0.20–0.70 range (prefer 0.25–0.40 sweet spot)
- Expiry window: projected + 14d to projected + 90d
- Open interest > 100, spread < 15%

**Composite scoring weights:**
| Factor | Weight | Why |
|--------|--------|-----|
| ROI | 35% | Primary objective |
| Delta proximity to 0.30–0.35 | 20% | Best leverage/risk ratio |
| Theta efficiency | 15% | Lower daily decay = better |
| Liquidity | 15% | Tight spreads, high OI |
| IV cheapness | 15% | Cheaper options = better entry |

**Display additions:** Delta badge, theta $/day, IV indicator (cheap/fair/expensive), composite score bar.

---

## Phase 3 — Full Pricing Model

**Adds:** Black-Scholes forward pricing, scenario analysis, position sizing.

**Black-Scholes upgrade:** Instead of intrinsic-only ROI, estimate what the option will *actually* be worth at the target price — including remaining time value. Significantly more accurate when expiry extends past the projected date.

**Scenario analysis per contract:**
| Scenario | Stock Price |
|----------|-------------|
| Stop loss hit | stopLoss or -5% |
| No move | currentPrice |
| 50% of move | halfway to target |
| 75% of move | 3/4 to target |
| Target hit | targetPrice |
| Overshoot +5% | targetPrice × 1.05 |

Each scenario shows: estimated option value, ROI %, and dollar P&L per contract.

**Position sizing:**
- Quarter-Kelly criterion as default
- Max 5% portfolio per trade, 15% across all options
- Input: portfolio value → output: suggested # of contracts

**Display additions:** Scenario table/chart, position size recommendation, risk/reward visualization.

---

## Integration with Coachtrack

**Where it lives:** New section within the Ticker Detail right panel, below the Primary Post Card. Only appears when the ParsedTrade has a target price and projected date.

**User flow (rough):**
1. Coach posts a rec → user adds via Quick Paste → ParsedTrade created
2. User taps into Ticker Detail → sees coach's analysis
3. Below the primary card: "Options Finder" section
4. System auto-fetches best contracts based on parsed data
5. User reviews ranked contracts → opens WeBull to execute

**No trade execution in Coachtrack.** This is analysis only — the user executes in WeBull.

---

## Open Questions for Design Session

1. **Where exactly does this surface?** Inside Ticker Detail? Separate action panel? Expandable section?
2. **How much data per contract?** Minimal card vs. expandable detail row?
3. **Phase progression in UI** — do all phases share one view that gets richer, or does Phase 3 get its own "deep analysis" panel?
4. **Scenario analysis visualization** — table? Mini chart? Spark bars?
5. **Auto-refresh cadence** — how often to re-rank during market hours?
6. **Mobile treatment** — full section or collapsed summary?
7. **Empty/loading states** — what to show when options chain is loading, or when no contracts pass filters?
8. **Contract comparison** — pin/compare 2-3 contracts side by side?

---

## Technical Reference

Full research, formulas, code snippets, and Polygon.io API details: [`docs/options-roi-research.md`](./options-roi-research.md)
