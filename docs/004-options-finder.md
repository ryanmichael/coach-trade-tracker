# 004 — Options Finder

**Handoff:** Claude Chat → Claude Code
**Date:** 2026-03-25
**Prototype:** `options-finder-v2.jsx`
**PRD:** `options-roi-prd.md`
**Phase:** 1 (Basic ROI Ranking)

---

## 1. What This Is

A standalone page in Coachtrack that ranks options contracts by estimated ROI for a given trade recommendation. The user selects a ticker (from coach recs or custom input), and the system fetches the options chain, filters it, and displays the top contracts as compact cards sorted by ROI.

**This is analysis only — no trade execution happens in Coachtrack.** The user reviews contracts here, then executes in WeBull.

---

## 2. Data Flow

```
ParsedTrade (from Quick Paste)
  → { ticker, direction, priceTargetHigh, projectedDate, stopLoss, currentPrice }
  → Polygon.io Options Chain Snapshot API
  → Filter + Rank
  → Display top 5 contracts
```

### 2.1 Inputs

From `ParsedTrade` record (already exists in the data model):
- `ticker` — e.g. "SPY"
- `direction` — "LONG" | "SHORT"
- `priceTargetHigh` — coach's target price
- `projectedDate` — coach's projected date for the move
- `stopLoss` — stop loss level

From Polygon.io (new API call):
- `currentPrice` — current stock price (use Polygon's previous close or last trade)
- Options chain snapshot — all available contracts for the ticker

### 2.2 Polygon.io API

**Endpoint:** `GET /v3/snapshot/options/{underlyingAsset}`

**Key params:**
- `strike_price.gte` / `strike_price.lte` — bracket around current price
- `expiration_date.gte` — projected date + 14 days
- `contract_type` — `call` for LONG, `put` for SHORT
- `limit` — 250 (fetch a wide set, filter client-side)

**Response fields needed per contract:**
- `details.strike_price`
- `details.expiration_date`
- `details.contract_type`
- `day.open_interest`
- `last_quote.ask` / `last_quote.bid`

See `docs/options-roi-research.md` for full API reference and code snippets.

---

## 3. Core Logic

### 3.1 ROI Calculation

```
Call ROI = (max(0, targetPrice - strike) - premium) / premium × 100
Put ROI  = (max(0, strike - targetPrice) - premium) / premium × 100
```

Where `premium` = ask price of the contract.

### 3.2 Break-even

```
Call break-even = strike + premium
Put break-even  = strike - premium
```

### 3.3 Estimated Value at Target

```
Call est. value = max(0, targetPrice - strike)
Put est. value  = max(0, strike - targetPrice)
```

### 3.4 Filters (applied before ranking)

| Filter | Threshold |
|--------|-----------|
| Contract type | Calls if LONG, puts if SHORT |
| Expiry | ≥ projectedDate + 14 days |
| Open interest | > 50 |
| Bid-ask spread | < 20% of midpoint price |

Spread % formula: `(ask - bid) / ((ask + bid) / 2) × 100`

### 3.5 Sweet Spot Detection

The "sweet spot" contract is: slightly OTM from current price, but well ITM at the target price, with good liquidity. In production, heuristic:

```
isSweetSpot =
  moneyness === "OTM"
  && estValueAtTarget > premium * 1.5
  && openInterest > median(allOI)
  && spreadPct < 10
```

Only one contract should be marked sweet spot (the best match).

### 3.6 Sorting

Default sort: ROI descending. User can toggle:
- **ROI** — `roi` desc
- **Premium** — `ask` asc (cheapest first)
- **Expiry** — `dte` asc (soonest first)

---

## 4. Page Structure

### 4.1 Layout (top to bottom)

```
┌─────────────────────────────────────────────┐
│  Page Header (Options Finder + status)      │
├─────────────────────────────────────────────┤
│  Ticker Selector                            │
│  [SPY▲] [AAPL▲] [TSLA▼] | [custom] [+ Add] │
├─────────────────────────────────────────────┤
│  Custom Ticker Form (only if custom)        │
│  Direction · Current · Target · Stop · Date │
├─────────────────────────────────────────────┤
│  Trade Context Bar (coach rec or filled)    │
│  TICKER  LONG  |  Current  Target  Stop     │
│  └─ Coach note with accent border           │
├─────────────────────────────────────────────┤
│  Sort Bar                                   │
│  Sort by: [ROI] [Premium] [Expiry]  5 contr │
├─────────────────────────────────────────────┤
│  Contract Card #1          [Sweet Spot]     │
│  #1  $575.00 C  OTM  May 1  37 DTE  ...    │
│  ├── OI bar                                 │
├─────────────────────────────────────────────┤
│  Contract Card #2                           │
│  ...                                        │
├─────────────────────────────────────────────┤
│  Summary Footer                             │
│  Best: $575 C · May 1 · +20.7% · $5.80     │
│                            [Open in WeBull] │
├─────────────────────────────────────────────┤
│  Methodology Note                           │
│  Phase 1: intrinsic only, no Greeks/IV      │
└─────────────────────────────────────────────┘
```

### 4.2 Ticker Selector

Two categories of chips side by side:

**Coach recs** (solid border): Populated from all `ParsedTrade` records that have `priceTargetHigh` and `projectedDate`. Each shows ticker + direction arrow (▲ for LONG, ▼ for SHORT). Active state: accent background tint + accent border.

**Custom tickers** (dashed border): User-added tickers not in the coach rec set. Shows × button to remove. Active state same as coach rec.

**Add input**: Text field with `+` prefix, accepts ticker symbol on Enter, max 5 chars, auto-uppercased. If ticker already exists (coach or custom), just selects it.

### 4.3 Custom Ticker Form

Only appears when a custom (non-coach) ticker is selected. Dashed warning-color border to visually distinguish from coach data.

Fields (all inline, single row):
- **Direction** — toggle between Long / Short buttons
- **Current Price** — number input
- **Target Price** — number input, accent-colored
- **Stop Loss** — number input, negative-colored
- **Projected Date** — date input

Status indicator: "✓ Ready" when current + target + date are filled, "Fill required fields" otherwise.

When ready, system generates contracts and displays them below.

### 4.4 Trade Context Bar

Shows for coach recs. Contains:
- Ticker (large mono) + direction badge + source badge ("Coach Rec" or "Custom")
- Metrics row: Current price, Target price (accent), Stop loss (red), Projected date + days away
- Coach note: in a subtle card with accent-colored left border

### 4.5 Contract Card

Compact single-row card with these fields left to right:

| Field | Format | Notes |
|-------|--------|-------|
| Rank | `#1` mono | Sweet spot gets green color |
| Strike + Type | `$575.00 C` | C for call, P for put |
| Moneyness | `OTM` badge | Yellow for OTM, green for ITM |
| Expiry | `May 1` + DTE | |
| Premium | `$5.80` + spread % | |
| Est. Value | `$7.00` green | Value at target price |
| Break-even | `$580.80` dimmed | |
| ROI | `+20.7%` large | Right-aligned, dominant. Green if positive, red if negative |

Below the main row: OI bar — thin progress bar normalized to max OI in the set, with numeric value.

Sweet Spot card: green-tinted background, green border, "Sweet Spot" badge positioned at top-right.

### 4.6 Summary Footer

Single row: "Best contract: $575 C · May 1 · +20.7% ROI for $5.80/contract"

CTA button: "Open in WeBull" — links out to WeBull (deep link TBD).

### 4.7 Empty / Loading States

- **Loading**: "Fetching options chain..." with subtle pulse
- **No contracts pass filters**: "No contracts match filters — Try adjusting expiry range or OI thresholds"
- **Custom ticker, no data entered**: "Enter trade details above to see contracts — Current price, target, and projected date are required"

---

## 5. Design System Reference

All values from Mercury Dark Mode. The prototype uses inline styles but production should use CSS modules or styled-components matching the existing codebase.

### 5.1 Colors

```
--bg:              #0B0D11
--surface:         #12151B
--surface-alt:     #181C24
--border:          #1E2330
--border-light:    #2A3040
--text-primary:    #E8E9ED
--text-secondary:  #8B8FA3
--text-tertiary:   #5C6178
--accent-primary:  #7C7CFF
--accent-dim:      rgba(124,124,255,0.12)
--semantic-positive:     #3FCF8E
--semantic-positive-dim: rgba(63,207,142,0.10)
--semantic-negative:     #FF6B6B
--semantic-negative-dim: rgba(255,107,107,0.10)
--semantic-warning:      #FFB547
--semantic-warning-dim:  rgba(255,181,71,0.10)
```

### 5.2 Typography

```
Font stack (sans):  'DM Sans', system-ui, sans-serif
Font stack (mono):  'DM Mono', 'SF Mono', monospace
```

Key sizes used:
- Page title: 18px / 600
- Ticker in context bar: 28px / 700 mono
- Strike price: 18px / 600 mono
- ROI value: 22px / 700 mono
- Field values: 13-14px / 500 mono
- Labels: 10-11px / 500-600 uppercase, 0.06em tracking
- Body / notes: 12-12.5px / 400

### 5.3 Spacing & Radii

- Card border-radius: 12px
- Badge border-radius: 4-6px
- Button border-radius: 6-8px
- Card padding: 18-20px horizontal, 16-20px vertical
- Section gap: 20px
- Page max-width: 960px
- Page padding: 28px 32px

---

## 6. Component Hierarchy

```
OptionsFinder (page)
├── PageHeader
├── TickerSelector
│   ├── CoachRecChip[] (from ParsedTrade records)
│   ├── CustomTickerChip[] (user-added, removable)
│   └── AddTickerInput
├── CustomTickerForm (conditional — custom tickers only)
│   ├── DirectionToggle
│   ├── PriceInput × 3 (current, target, stop)
│   ├── DateInput
│   └── StatusIndicator
├── TradeContextBar (conditional — coach recs only)
│   ├── TickerDisplay + DirectionBadge + SourceBadge
│   ├── MetricPill × 4
│   └── CoachNote
├── FilterBar
│   ├── SortButton × 3
│   └── FilterSummary
├── ContractCard[] (sorted list)
│   ├── RankIndicator
│   ├── StrikeDisplay + MoneynesssBadge
│   ├── ExpiryDisplay
│   ├── PremiumDisplay
│   ├── EstValueDisplay
│   ├── BreakevenDisplay
│   ├── ROIDisplay
│   ├── OIBar
│   └── SweetSpotBadge (conditional)
├── SummaryFooter
│   ├── BestContractSummary
│   └── WeBullCTA
└── MethodologyNote
```

---

## 7. State Management

```typescript
// Page-level state
selectedTicker: string           // Current ticker being viewed
sortBy: "roi" | "premium" | "expiry"
customTickers: string[]          // User-added ticker symbols
customDrafts: Record<string, CustomTradeInput>

// Derived (not stored)
isCoachRec: boolean              // selectedTicker exists in ParsedTrade records
currentTrade: ParsedTrade | CustomTradeInput
contracts: EnrichedContract[]    // Fetched + filtered + computed
sorted: EnrichedContract[]       // Re-sorted based on sortBy
```

### 7.1 CustomTradeInput type

```typescript
interface CustomTradeInput {
  ticker: string;
  direction: "LONG" | "SHORT";
  currentPrice: number;
  priceTargetHigh: number;
  projectedDate: string;     // ISO date
  stopLoss: number;
  hasCoachRec: false;
}
```

### 7.2 EnrichedContract type

```typescript
interface EnrichedContract {
  id: string;
  strike: number;
  expiry: string;            // ISO date
  ask: number;
  bid: number;
  openInterest: number;
  contractType: "call" | "put";
  // Computed:
  roi: number;               // percentage
  breakeven: number;
  estValue: number;          // intrinsic value at target
  spread: number;            // bid-ask spread %
  dte: number;               // days to expiry
  moneyness: "ITM" | "ATM" | "OTM";
  isSweetSpot: boolean;
}
```

---

## 8. Integration Points

### 8.1 With Existing ParsedTrade

The Options Finder reads from the same `ParsedTrade` records created by Quick Paste. It needs `priceTargetHigh` and `projectedDate` to function — if either is missing, the ticker should not appear in the coach rec chips.

### 8.2 With Polygon.io

New API integration. Requires:
- API key in env
- Rate limiting (5 calls/min on free tier)
- Caching: cache the snapshot per ticker for 5 minutes during market hours, 1 hour outside
- Error handling: API down → show error state, invalid ticker → show "ticker not found"

### 8.3 With WeBull

The "Open in WeBull" CTA should deep-link to the contract page if possible. WeBull deep link format TBD — for now, link to `https://app.webull.com/stocks/{ticker}` as fallback.

---

## 9. Phase 2/3 Extension Points

The architecture should make these additions straightforward:

**Phase 2 (Greeks Intelligence):**
- Add `delta`, `theta`, `iv` fields to `EnrichedContract`
- Add composite score computation alongside ROI
- New sort option: "Score"
- Additional badges in contract card: delta, theta $/day, IV indicator
- Polygon provides greeks in the same snapshot endpoint

**Phase 3 (Black-Scholes + Scenarios):**
- New `ScenarioAnalysis` component below contract cards
- Position sizing section (needs portfolio value input)
- Black-Scholes pricing function (pure math, no API needed)

Design these as optional sub-components that can be toggled on — don't embed Phase 2/3 logic into Phase 1 components.

---

## 10. Kickoff Prompt for Claude Code

```
Read these files:
- docs/004-options-finder.md (this spec)
- docs/options-roi-prd.md (product requirements)
- docs/options-roi-research.md (API details + formulas)
- prototype/options-finder-v2.jsx (UI reference)

Implement the Options Finder page (Phase 1 only). Key points:
- New route/page in the existing app
- Polygon.io integration for options chain data
- All computation logic from §3
- Component structure from §6
- State management from §7
- Match the prototype's visual design using the Mercury Dark Mode design system
- Cache API responses per §8.2
```
