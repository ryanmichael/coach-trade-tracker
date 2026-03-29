# 004a — Options Finder: Estimate Panel

**Handoff:** Claude Chat → Claude Code
**Date:** 2026-03-28
**Parent spec:** `docs/004-options-finder.md`
**Prototype:** `prototype/options-finder-v3.jsx` (see `EstimatePanel` component + `InfoTip`)
**Scope:** Inline Estimate panel within the Options Finder contract list

---

## 1. What This Is

An inline expansion panel that opens below a selected contract card. It lets the user enter an investment amount and see a scenario matrix showing estimated option prices, total return, and ROI across two axes: **when the price moves** (time) and **how far the price moves** from strike (distance).

The purpose is exit planning — helping the user understand how much they'd make if the stock hits various prices at different points in the trade's timeline.

---

## 2. User Flow

1. User views the ranked contract list on the Options Finder page
2. User clicks **"Estimate"** button on a contract card's OI bar row
3. The contract card's bottom corners square off and the Estimate panel expands below it, visually connected
4. User enters investment amount and adjusts distance-from-strike values
5. Scenario matrix renders immediately (no submit button — reactive)
6. User clicks **"Close"** or clicks "Estimate" on a different contract (only one open at a time)

---

## 3. Props Interface

```typescript
interface EstimatePanelProps {
  contract: EnrichedContract;  // The selected contract (see 004-options-finder.md §7.2)
  trade: ParsedTrade;          // The active trade rec (provides projectedDate)
  onClose: () => void;         // Closes the panel
}
```

The parent (`OptionsFinder` page) manages which contract is being estimated via an `estimatingId` state variable. Only one contract can be estimated at a time — selecting a new one closes the previous.

---

## 4. Panel Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Contract Card (border-radius becomes 12px 12px 0 0)       │
│  #2  $575.00 C  OTM  May 1  37 DTE  ...        +20.7%     │
│  OI ████░░░░░░ 9,840                    [Estimating...]    │
├─────────────────────────────────────────────────────────────┤
│  ESTIMATE  $575.00 C · May 1                      [Close]  │
│─────────────────────────────────────────────────────────────│
│  INVESTMENT (i)        DISTANCE FROM STRIKE ($)             │
│  [$  500 ]             [$1] [$3] [$5] [$10] [+$ custom ]   │
│─────────────────────────────────────────────────────────────│
│  If target price hits — est. option value + total return    │
│                                                             │
│  Ticker Price    │ Early Exit    │ On Time      │ Near Exp  │
│  ─────────────────────────────────────────────────────────  │
│  $564.00 OTM -$1 │ $3.82 -34%   │ $2.10  -64%  │ $0  -100% │
│  $567.00 OTM -$3 │ ...          │ ...          │ ...       │
│  $570.00 OTM -$5 │ ...          │ ...          │ ...       │
│  $565.00 OTM -$10│ ...          │ ...          │ ...       │
│  $575.00 ATM     │ ...          │ ...          │ ...       │ ← highlighted
│  $576.00 ITM +$1 │ ...          │ ...          │ ...       │
│  $578.00 ITM +$3 │ ...          │ ...          │ ...       │
│  $580.00 ITM +$5 │ ...          │ ...          │ ...       │
│  $585.00 ITM +$10│ ...          │ ...          │ ...       │
│─────────────────────────────────────────────────────────────│
│  Based on 1 contract ($580 invested) · Early = ...          │
│  Simplified Black-Scholes estimate — actual prices vary     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Inputs

### 5.1 Investment Amount

- Dollar input field with `$` prefix
- Default: `500`
- Step: 100
- System computes: `numContracts = floor(investment / (ask × 100))` and `actualCost = numContracts × ask × 100`
- Helper text lives inside an **InfoTip** (ⓘ icon next to "Investment" label). Hover/tap shows tooltip:
  - If numContracts > 0: `"3 contracts · $1,740.00 actual cost"`
  - If numContracts === 0: `"Min $580.00 for 1 contract"`

### 5.2 Distance from Strike

- Chip-based selector showing dollar amounts ± from strike price
- **Defaults:** $1, $3, $5, $10
- Each chip is **removable** (× button)
- **Custom input:** `+$` prefixed number field, adds on Enter
- Duplicates and zero/negative values are rejected
- Chips always display sorted ascending

---

## 6. Scenario Matrix

### 6.1 Time Axis (Columns)

Three columns anchored to the **coach's projected date**, not the contract's expiry:

| Column | When | Days to Expiry at that Point | Color |
|--------|------|------|-------|
| **Early Exit** | Halfway to projected date | `dte - round(projDays / 2)` | Green (`--semantic-positive`) |
| **On Time** | At projected date | `dte - projDays` | Yellow (`--semantic-warning`) |
| **Near Expiry** | At contract expiry | `0` | Red (`--semantic-negative`) |

Each column header shows: label + subtitle with day number and DTE remaining (e.g., "Day 12 — 25 DTE left").

**Why this framing:** The user wants to plan their exit based on when the coach's thesis plays out. "If the stock hits target early, I capture time value. If it takes until expiry, I only get intrinsic." This makes the time-decay cost of waiting viscerally clear.

### 6.2 Price Axis (Rows)

Rows are strike price ± each selected distance amount. Row ordering depends on contract type:

**For calls (long direction):**
1. OTM rows first (strike - $10, strike - $5, ...) — sorted largest distance to smallest
2. ATM row (strike itself) — highlighted with accent background
3. ITM rows (strike + $1, strike + $3, ...) — sorted smallest distance to largest

**For puts (short direction):**
1. OTM rows first (strike + $1, strike + $3, ...) — sorted smallest to largest
2. ATM row (strike itself) — highlighted
3. ITM rows (strike - $1, strike - $3, ...) — sorted largest distance to smallest

Each row shows: ticker price, ITM/OTM/ATM badge (color-coded), and the ± label.

### 6.3 Cell Values

Each cell computes the estimated option price using simplified Black-Scholes, then derives total return:

```
optionPrice = blackScholes(tickerPrice, strike, daysRemaining, contractType, iv=0.25)
totalValue  = optionPrice × numContracts × 100
pnl         = totalValue - actualCost
roi         = (pnl / actualCost) × 100
```

Each cell displays three lines:
1. **Option price** — `$3.82` (primary text color)
2. **ROI %** — `+34.2%` or `-64.1%` (green if profit, red if loss, bold)
3. **Dollar P&L** — `+$198.00` or `-$372.00` (same color, smaller)

---

## 7. Black-Scholes Implementation

Simplified model with assumed constants:

```typescript
function estimateOptionPrice(
  stockPrice: number,
  strike: number,
  daysRemaining: number,
  contractType: "call" | "put",
  iv: number = 0.25         // assumed implied volatility
): number {
  if (daysRemaining <= 0) {
    // At expiry: intrinsic value only
    return contractType === "call"
      ? Math.max(0, stockPrice - strike)
      : Math.max(0, strike - stockPrice);
  }

  const S = stockPrice;
  const K = strike;
  const T = daysRemaining / 365;
  const r = 0.045;           // assumed risk-free rate
  const sigma = iv;
  const sqrtT = Math.sqrt(T);

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  if (contractType === "call") {
    return S * cumulativeNormal(d1) - K * Math.exp(-r * T) * cumulativeNormal(d2);
  }
  return K * Math.exp(-r * T) * cumulativeNormal(-d2) - S * cumulativeNormal(-d1);
}
```

Uses the Abramowitz & Stegun approximation for the cumulative normal distribution (see prototype for implementation).

**Constants are intentionally simplified for Phase 1.** Phase 2 will replace assumed IV with actual IV from the Polygon snapshot, and Phase 3 adds real Greeks.

---

## 8. InfoTip Component

Reusable tooltip component used next to the Investment label. Spec:

```typescript
interface InfoTipProps {
  text: string;    // Tooltip content
}
```

**Behavior:**
- Renders a 14×14px circle with "i" character
- Border: `1px solid textTertiary/55%`
- **Show on hover** (mouseEnter/mouseLeave) and **toggle on click** (for mobile)
- Tooltip appears **above** the icon, centered horizontally
- Dark popover: `surface` background, `borderLight` border, `0 4px 12px rgba(0,0,0,0.4)` shadow
- Small downward-pointing caret arrow connecting tooltip to icon
- Content: single-line text, `fontSize: 10`, `textSecondary` color, `whiteSpace: nowrap`
- z-index: 10

---

## 9. Visual Connection to Contract Card

When the Estimate panel is open:

- **Contract card** changes `borderRadius` from `12px` to `12px 12px 0 0` (squared bottom)
- **Contract card** border color shifts to `accent/40%`
- **Contract card** margin-bottom becomes `0` (eliminates gap)
- **Estimate panel** has `borderRadius: 0 0 12px 12px` (squared top, rounded bottom)
- **Estimate panel** top border uses `accent/20%` to create a subtle seam
- The **"Estimate" button** on the card changes text to "Estimating..." and gets accent styling

This creates the visual effect of a single connected card + panel unit.

---

## 10. State Management

All state is local to the EstimatePanel component:

```typescript
// Local state
purchaseAmount: number     // Default: 500
distances: number[]        // Default: [1, 3, 5, 10]
customDist: string         // Input buffer for custom distance field

// Derived (computed each render)
numContracts: number       // floor(purchaseAmount / (ask × 100))
actualCost: number         // numContracts × ask × 100
priceRows: PriceRow[]      // Built from distances + strike + contractType
timeWindows: TimeWindow[]  // Built from trade.projectedDate + contract.dte
```

Parent state (in `OptionsFinder`):

```typescript
estimatingId: string | null  // contract.id of the open estimate, or null
```

---

## 11. Empty / Edge States

| Condition | Display |
|-----------|---------|
| Investment too low for 1 contract | Center text: "Enter at least $580.00 to purchase 1 contract" |
| All distance chips removed | Table renders with just the ATM (strike) row |
| Contract expiry < projected date | Near Expiry column still shows 0 DTE; On Time may show negative DTE — clamp to 0 |

---

## 12. Component Hierarchy

```
ContractCard
  └── "Estimate" button (in OI bar row)
EstimatePanel (sibling, renders below card when estimatingId matches)
  ├── PanelHeader (contract summary + Close button)
  ├── InputRow
  │   ├── InvestmentInput + InfoTip
  │   └── DistanceChips + CustomDistanceInput
  ├── ScenarioTable
  │   ├── TableHeader (Ticker Price + 3 time columns)
  │   └── TableRow[] (one per price point)
  │       ├── PriceLabel (price + ITM/OTM badge + ± label)
  │       └── ScenarioCell × 3 (option price + ROI + P&L)
  └── TableFooter (legend + disclaimer)
```

---

## 13. Kickoff Prompt for Claude Code

```
Read these files:
- docs/004a-estimate-panel.md (this spec)
- docs/004-options-finder.md (parent page spec)
- prototype/options-finder-v3.jsx (UI reference — see EstimatePanel and InfoTip components)

Implement the Estimate Panel feature within the Options Finder page.
Key points:
- Inline panel that expands below the selected contract card
- Investment input with InfoTip tooltip
- Distance-from-strike chip selector (add/remove/custom)
- Scenario matrix: 3 time columns (Early Exit / On Time / Near Expiry) × N price rows
- Time axis anchored to coach's projected date, not contract DTE
- Simplified Black-Scholes for option price estimation (§7)
- Visual connection between card and panel (§9)
- All state local to the panel except estimatingId on the parent (§10)
```
