# Options ROI Estimation — Research Reference

**Purpose:** Given a coach's trade recommendation (ticker, direction, target price, projected date), estimate the best risk-adjusted ROI across available options contracts. Phased approach from simple intrinsic-value math to full Black-Scholes pricing.

**Last Updated:** 2026-03-25

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Phase 1: Intrinsic Value ROI](#2-phase-1-intrinsic-value-roi)
3. [Phase 2: Delta Filtering + Theta Awareness](#3-phase-2-delta-filtering--theta-awareness)
4. [Phase 3: Black-Scholes Pricing](#4-phase-3-black-scholes-pricing)
5. [Contract Ranking Model](#5-contract-ranking-model)
6. [Position Sizing](#6-position-sizing)
7. [Polygon.io Options API](#7-polygonio-options-api)
8. [Implementation Notes](#8-implementation-notes)

---

## 1. Core Concepts

### What We Have From the Coach

| Field | Example | Source |
|-------|---------|--------|
| `ticker` | AAPL | ParsedTrade |
| `currentPrice` | $172.00 | Polygon price API |
| `targetPrice` | $190.00 | `priceTargetHigh` from ParsedTrade |
| `projectedDate` | 2026-04-15 | `projectedDate` from ParsedTrade |
| `direction` | long | ParsedTrade direction |
| `confirmationPrice` | $175.00 | `priceConfirmation` (optional) |
| `stopLoss` | $165.00 | `stopLoss` (optional) |

### What We Need From the Options Chain

For each candidate contract:

| Field | Source |
|-------|--------|
| Strike price | Polygon contracts / chain snapshot |
| Expiration date | Polygon contracts / chain snapshot |
| Ask price (premium) | `last_quote.ask` from chain snapshot |
| Bid price | `last_quote.bid` from chain snapshot |
| Delta | `greeks.delta` from chain snapshot |
| Theta | `greeks.theta` from chain snapshot |
| Gamma | `greeks.gamma` from chain snapshot |
| Vega | `greeks.vega` from chain snapshot |
| Implied volatility | `implied_volatility` from chain snapshot |
| Open interest | `open_interest` from chain snapshot |
| Bid-ask spread | Derived: `ask - bid` |

### Option Value Decomposition

```
Option Premium = Intrinsic Value + Extrinsic Value (Time Value)

Call Intrinsic Value = max(0, Stock Price - Strike Price)
Put Intrinsic Value  = max(0, Strike Price - Stock Price)

Extrinsic Value = Premium - Intrinsic Value
```

Extrinsic value erodes to zero at expiration. At expiry, an option is worth exactly its intrinsic value.

### Moneyness

| Term | Call | Put |
|------|------|-----|
| In-the-Money (ITM) | Stock > Strike | Stock < Strike |
| At-the-Money (ATM) | Stock ~ Strike | Stock ~ Strike |
| Out-of-the-Money (OTM) | Stock < Strike | Stock > Strike |

---

## 2. Phase 1: Intrinsic Value ROI

The simplest model. Assumes the stock hits the target price at expiration and calculates what the option would be worth using intrinsic value alone (ignoring remaining time value).

### Formula

```
For CALLS (long direction):
  estimatedValueAtTarget = max(0, targetPrice - strikePrice)
  ROI = (estimatedValueAtTarget - askPremium) / askPremium

For PUTS (short direction):
  estimatedValueAtTarget = max(0, strikePrice - targetPrice)
  ROI = (estimatedValueAtTarget - askPremium) / askPremium
```

### Example

Coach says: AAPL target $190, currently $172, long direction.

| Contract | Strike | Ask | Est. Value at $190 | ROI |
|----------|--------|-----|-------------------|-----|
| AAPL 260418 C170 | $170 | $8.50 | $20.00 | 135% |
| AAPL 260418 C175 | $175 | $5.20 | $15.00 | 188% |
| AAPL 260418 C180 | $180 | $3.10 | $10.00 | 223% |
| AAPL 260418 C185 | $185 | $1.60 | $5.00 | 213% |
| AAPL 260418 C190 | $190 | $0.70 | $0.00 | -100% |
| AAPL 260418 C195 | $195 | $0.30 | $0.00 | -100% |

Key observations:
- The $190 strike (ATM at target) returns zero intrinsic value -- the stock needs to go ABOVE $190 for that call to have value at expiry.
- OTM strikes above the target are total losses.
- The "sweet spot" is slightly OTM from current price but well ITM at the target price.
- Phase 1 is conservative: real value at target will include remaining time value if expiry is after the projected date.

### Limitations of Phase 1

- Ignores time value remaining (if expiry > projected date, option is worth more than intrinsic)
- Ignores probability of hitting the target
- Doesn't account for how "expensive" the option is relative to its fair value
- The $180 strike looks best by ROI%, but has lower probability than the $170 strike

### Phase 1 Implementation

```typescript
interface Phase1Input {
  targetPrice: number;
  direction: 'long' | 'short';
  contracts: {
    strikePrice: number;
    askPrice: number;
    contractType: 'call' | 'put';
    expirationDate: string;
  }[];
}

function estimateROI(input: Phase1Input): { strikePrice: number; roi: number; estimatedValue: number }[] {
  return input.contracts.map(c => {
    const estimatedValue = input.direction === 'long'
      ? Math.max(0, input.targetPrice - c.strikePrice)
      : Math.max(0, c.strikePrice - input.targetPrice);

    const roi = (estimatedValue - c.askPrice) / c.askPrice;

    return { strikePrice: c.strikePrice, roi, estimatedValue };
  });
}
```

---

## 3. Phase 2: Delta Filtering + Theta Awareness

### Delta: The Strike Selection Tool

Delta measures how much the option price moves per $1 move in the underlying stock. It also serves as a rough proxy for the probability that the option finishes ITM at expiration.

| Delta Range | Moneyness | Character | Use Case |
|-------------|-----------|-----------|----------|
| 0.80-1.00 | Deep ITM | Stock replacement, minimal leverage | High conviction, capital-intensive |
| 0.60-0.80 | ITM | Good directional exposure, moderate cost | Balanced risk/reward |
| 0.45-0.55 | ATM | Highest absolute dollar theta, 50/50 odds | Moderate conviction |
| 0.25-0.40 | Slightly OTM | Best leverage/risk ratio, fastest delta acceleration | **Optimal for directional bets** |
| 0.05-0.25 | Deep OTM | Lottery ticket, high leverage, low probability | Speculative only |

**The 0.30 delta sweet spot:** OTM options near 0.30 delta experience the fastest delta acceleration (gamma) when the stock moves favorably. A $1 move that takes delta from 0.30 to 0.40 means the option is now moving 33% faster with the stock. This creates an accelerating return profile -- exactly what you want for a directional trade with a specific target.

**Hedge fund heuristic:** For directional trades with defined targets, the 0.25-0.40 delta range offers the best risk-adjusted leverage. Enough skin in the game that the option moves meaningfully, cheap enough that total loss is manageable.

### Delta Filtering Rules

```typescript
interface DeltaFilter {
  // Minimum delta — below this, probability is too low
  minDelta: number;  // Default: 0.20

  // Maximum delta — above this, cost is too high for the leverage
  maxDelta: number;  // Default: 0.70

  // Ideal range for ranking bonus
  idealDeltaLow: number;   // Default: 0.25
  idealDeltaHigh: number;  // Default: 0.45
}
```

Note: Put deltas are negative. Use `Math.abs(delta)` for comparison.

### Theta: The Time Decay Tax

Theta is the daily cost of holding an option (in dollars per day). It answers: "How much am I paying per day for the right to wait?"

Key patterns:
- Theta accelerates as expiration approaches. Options lose ~50% of time value in the final 30 days.
- The last 7-14 days are the steepest decay zone.
- Theta is highest for ATM options and drops for deep ITM/OTM.

**The expiration date rule of thumb:**

```
Minimum expiry = projectedDate + 14 days
Ideal expiry   = projectedDate + 30 to 45 days
Maximum expiry = projectedDate + 90 days
```

Rationale:
- **+14 days minimum:** Ensures you're not in the steepest theta decay zone if the coach's timeline is approximate. Coaches are often early.
- **+30-45 days ideal:** Theta is present but not punishing. Gives the trade room to develop. If the move happens early, you capture both intrinsic gain AND remaining time value on exit.
- **+90 days maximum:** Beyond this, you're paying for time value you don't need. Capital efficiency drops.

**Why extend past the projected date:** If the coach says "target by April 15" and you buy an April 18 expiry, you have 3 days of cushion. If AAPL hits $188 on April 10 (close but not target), you're watching it decay rapidly with no buffer. Buying the May 16 expiry means you can hold through the projected date, capture partial moves, and still have time value to sell.

### Theta-Adjusted ROI

```
Daily theta cost = |theta| (from Greeks)
Days to projected date = projectedDate - today
Total theta cost = daily theta cost * days to projected date

Theta-adjusted ROI = (estimatedValueAtTarget - askPremium - totalThetaCost) / askPremium
```

This is an approximation since theta is not constant, but it captures the directional penalty.

### Implied Volatility: Is the Option Cheap or Expensive?

IV represents the market's expectation of future price movement, priced into the option premium.

**IV Rank formula:**
```
IV Rank = (current IV - 52-week low IV) / (52-week high IV - 52-week low IV) * 100
```

**IV Percentile formula:**
```
IV Percentile = (# of days in past year with IV lower than today) / (total trading days) * 100
```

| IV Rank/Percentile | Interpretation | Action for Buyers |
|-------------------|----------------|-------------------|
| 0-25% | Options are cheap relative to history | Favorable for buying |
| 25-50% | Below average | Acceptable |
| 50-75% | Above average | Proceed with caution, premiums elevated |
| 75-100% | Options are expensive | Avoid buying or reduce size |

**Practical note:** Polygon.io returns `implied_volatility` per contract but not historical IV rank. To compute IV rank, you'd need to store daily IV snapshots over time or use a separate data source for historical IV.

**Simple IV filter for Phase 2:** Compare the contract's IV to the underlying stock's historical volatility (HV). If IV > 1.5x HV, the option is "expensive" -- flag it but don't exclude it (high IV can be justified by upcoming catalysts).

### Liquidity Filters

Poor liquidity means bad fills and hidden costs.

```typescript
interface LiquidityFilter {
  minOpenInterest: number;     // Default: 100
  maxBidAskSpreadPct: number;  // Default: 0.15 (15% of midpoint)
  minBidSize: number;          // Default: 5
}

function bidAskSpreadPct(bid: number, ask: number): number {
  const midpoint = (bid + ask) / 2;
  if (midpoint === 0) return Infinity;
  return (ask - bid) / midpoint;
}
```

**Why this matters:** A $1.00 option with a $0.80 bid / $1.20 ask has a 40% spread. You're underwater 20% the moment you buy. Hedge funds won't touch spreads above 10-15% of midpoint.

### Phase 2 Composite Filter

```typescript
function passesPhase2Filter(contract: OptionContract): boolean {
  const absDelta = Math.abs(contract.greeks.delta);

  // Delta bounds
  if (absDelta < 0.20 || absDelta > 0.70) return false;

  // Expiration bounds
  const daysToExpiry = daysBetween(today, contract.expirationDate);
  const daysToProjected = daysBetween(today, projectedDate);
  if (daysToExpiry < daysToProjected + 14) return false;
  if (daysToExpiry > daysToProjected + 90) return false;

  // Liquidity
  if (contract.openInterest < 100) return false;
  if (bidAskSpreadPct(contract.bid, contract.ask) > 0.15) return false;

  return true;
}
```

---

## 4. Phase 3: Black-Scholes Pricing

### The Question Phase 3 Answers

"If the stock hits $190 on April 15, what will this option *actually* be worth -- including remaining time value?"

Phase 1 only uses intrinsic value. Phase 3 uses Black-Scholes to estimate the full option price at a future stock price with a future time remaining.

### Black-Scholes Formula

For a European call:
```
C = S * N(d1) - K * e^(-rT) * N(d2)

Where:
  S = stock price (use targetPrice for forward-looking estimate)
  K = strike price
  r = risk-free interest rate (annualized, ~0.04-0.05 for US T-bills)
  T = time to expiration in years (remaining time AFTER projected date)
  σ = volatility (use implied volatility from current chain data)

  d1 = [ln(S/K) + (r + σ²/2) * T] / (σ * √T)
  d2 = d1 - σ * √T

  N(x) = cumulative standard normal distribution function
```

For a European put:
```
P = K * e^(-rT) * N(-d2) - S * N(-d1)
```

### Forward-Looking Option Valuation

To estimate what a contract will be worth when the target is hit:

```typescript
function estimateOptionValueAtTarget(
  targetPrice: number,       // Coach's target (becomes S in BS)
  strikePrice: number,       // K
  expirationDate: Date,      // Contract expiry
  projectedDate: Date,       // When target is expected to hit
  impliedVolatility: number, // Current IV (annualized, as decimal e.g. 0.35)
  riskFreeRate: number,      // e.g. 0.045
  contractType: 'call' | 'put'
): number {
  // T = remaining time from projected date to expiration, in years
  const remainingDays = daysBetween(projectedDate, expirationDate);
  const T = remainingDays / 365;

  if (T <= 0) {
    // Option expires on or before projected date — intrinsic only
    return contractType === 'call'
      ? Math.max(0, targetPrice - strikePrice)
      : Math.max(0, strikePrice - targetPrice);
  }

  // Black-Scholes with S = targetPrice, T = remaining time after target hit
  return blackScholes(targetPrice, strikePrice, T, riskFreeRate, impliedVolatility, contractType);
}
```

### Phase 3 ROI

```
estimatedFutureValue = estimateOptionValueAtTarget(...)
ROI = (estimatedFutureValue - currentAskPremium) / currentAskPremium
```

This is significantly more accurate than Phase 1 because:
1. It captures remaining time value (options with longer expiries are worth more even at the same stock price)
2. It accounts for how far ITM the option will be at target (deep ITM options have less time value)
3. It uses actual IV to model the uncertainty premium

### Black-Scholes Implementation

The `black-scholes` npm package provides this out of the box:

```typescript
// npm install black-scholes
import bs from 'black-scholes';

// bs(stockPrice, strikePrice, timeToExpiry, riskFreeRate, volatility, callOrPut)
// callOrPut: 'call' or 'put'
// Returns: option price as a number

const price = bs.blackScholes(190, 175, 0.08, 0.045, 0.30, 'call');
// Returns estimated call price with S=$190, K=$175, T=0.08yr, r=4.5%, IV=30%
```

If building from scratch, the key dependency is the cumulative normal distribution function:

```typescript
// Cumulative standard normal distribution (rational approximation)
function cdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function blackScholesCall(S: number, K: number, T: number, r: number, sigma: number): number {
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
}

function blackScholesPut(S: number, K: number, T: number, r: number, sigma: number): number {
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
}
```

### Sensitivity: Scenario Analysis

Don't just estimate at the exact target. Model a range:

```typescript
interface ScenarioResult {
  stockPrice: number;
  optionValue: number;
  roi: number;
  probability: number;  // Rough estimate from delta
}

function runScenarios(
  currentStockPrice: number,
  targetPrice: number,
  stopLoss: number | null,
  contract: OptionContract,
  projectedDate: Date
): ScenarioResult[] {
  const scenarios = [
    { label: 'Stop Loss Hit', price: stopLoss ?? currentStockPrice * 0.95 },
    { label: 'No Move', price: currentStockPrice },
    { label: '50% of Move', price: currentStockPrice + (targetPrice - currentStockPrice) * 0.5 },
    { label: '75% of Move', price: currentStockPrice + (targetPrice - currentStockPrice) * 0.75 },
    { label: 'Target Hit', price: targetPrice },
    { label: 'Target +5%', price: targetPrice * 1.05 },
  ];

  return scenarios.map(s => {
    const optionValue = estimateOptionValueAtTarget(
      s.price, contract.strikePrice, contract.expirationDate,
      projectedDate, contract.impliedVolatility, 0.045, contract.contractType
    );
    return {
      stockPrice: s.price,
      optionValue,
      roi: (optionValue - contract.ask) / contract.ask,
    };
  });
}
```

---

## 5. Contract Ranking Model

### Composite Score

Rank all contracts that pass the Phase 2 filter using a weighted composite score:

```typescript
interface ScoringWeights {
  roi: number;          // Phase 1 or Phase 3 ROI estimate — Default: 0.35
  delta: number;        // Proximity to ideal delta range — Default: 0.20
  theta: number;        // Lower daily decay is better — Default: 0.15
  liquidity: number;    // Tighter spread + higher OI — Default: 0.15
  ivRank: number;       // Lower IV rank is better (cheaper) — Default: 0.15
}
```

### Score Components (each normalized 0-1)

```typescript
// 1. ROI Score — higher is better, capped at 500% to avoid lottery-ticket bias
function roiScore(roi: number): number {
  return Math.min(roi / 5.0, 1.0);
}

// 2. Delta Score — peak at ideal range center (0.35), drops off symmetrically
function deltaScore(absDelta: number, idealCenter: number = 0.35): number {
  const distance = Math.abs(absDelta - idealCenter);
  return Math.max(0, 1.0 - distance / 0.35);
}

// 3. Theta Score — lower absolute theta per dollar invested is better
function thetaScore(theta: number, askPrice: number): number {
  const thetaPerDollar = Math.abs(theta) / askPrice;
  // Normalize: <1% daily decay = perfect, >5% = terrible
  return Math.max(0, 1.0 - thetaPerDollar / 0.05);
}

// 4. Liquidity Score — combines spread and OI
function liquidityScore(bid: number, ask: number, openInterest: number): number {
  const spreadPct = (ask - bid) / ((bid + ask) / 2);
  const spreadScore = Math.max(0, 1.0 - spreadPct / 0.15);
  const oiScore = Math.min(openInterest / 1000, 1.0);
  return spreadScore * 0.6 + oiScore * 0.4;
}

// 5. IV Score — lower IV rank is better for buyers
function ivScore(ivRank: number): number {
  // ivRank is 0-100
  return 1.0 - ivRank / 100;
}
```

### Final Ranking

```typescript
function compositeScore(contract: ScoredContract, weights: ScoringWeights): number {
  return (
    weights.roi * roiScore(contract.roi) +
    weights.delta * deltaScore(Math.abs(contract.delta)) +
    weights.theta * thetaScore(contract.theta, contract.ask) +
    weights.liquidity * liquidityScore(contract.bid, contract.ask, contract.openInterest) +
    weights.ivRank * ivScore(contract.ivRank)
  );
}

// Sort descending by composite score, return top N
```

### ITM vs ATM vs OTM Tradeoffs Summary

| Aspect | ITM (0.60-0.80 delta) | ATM (0.45-0.55) | OTM (0.25-0.40) |
|--------|----------------------|-----------------|-----------------|
| Premium cost | Highest | Moderate | Lowest |
| Probability of profit | Highest | ~50% | Lowest |
| Leverage (% return) | Lowest | Moderate | Highest |
| Theta decay impact | Lowest (mostly intrinsic) | Highest (most time value) | Moderate |
| Capital required | Most | Moderate | Least |
| Best for | High conviction, risk-averse | Balanced | Defined risk, high upside |

**For coach trade recommendations:** The 0.25-0.40 delta range is typically optimal. Coach gives a specific target and timeframe, which means you have a defined thesis. You want leverage on that thesis without paying for probability you don't need (deep ITM).

---

## 6. Position Sizing

### Kelly Criterion (Adapted for Options)

```
Kelly % = (W * R - L) / R

Where:
  W = estimated win probability (use delta as proxy, or coach's historical accuracy)
  L = 1 - W
  R = reward/risk ratio = (expected gain if win) / (max loss if lose)

For options:
  Max loss = premium paid (defined risk)
  Expected gain = estimated ROI * premium
  R = estimated ROI (since risk = 1x premium)
```

**Example:**
- Delta 0.35 call (35% probability proxy)
- Estimated ROI at target: 200%
- Kelly % = (0.35 * 2.0 - 0.65) / 2.0 = 0.025 = 2.5% of portfolio

**Always use fractional Kelly.** Full Kelly is mathematically optimal but assumes perfect probability estimates (which we never have). Practical sizing:

| Approach | Multiplier | Use Case |
|----------|------------|----------|
| Full Kelly | 1.0x | Never use in practice |
| Half Kelly | 0.5x | Aggressive, high-conviction trades |
| Quarter Kelly | 0.25x | **Recommended default** |
| Eighth Kelly | 0.125x | Low-conviction or high-IV environments |

**Hard caps:**
- Never risk more than 5% of portfolio on a single options trade
- Never risk more than 15% of portfolio across all open options positions
- Options are defined risk (max loss = premium), so the premium IS the position size calculation

### Simplified Position Sizing

```typescript
function maxContractsToTrade(
  portfolioValue: number,
  askPrice: number,       // Per-share premium
  sharesPerContract: number, // Usually 100
  maxRiskPct: number = 0.02  // 2% default (quarter Kelly territory)
): number {
  const maxDollarsAtRisk = portfolioValue * maxRiskPct;
  const contractCost = askPrice * sharesPerContract;
  return Math.floor(maxDollarsAtRisk / contractCost);
}
```

---

## 7. Polygon.io Options API

### Endpoint Inventory

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v3/snapshot/options/{underlying}` | GET | **Options chain snapshot** — prices, greeks, IV, OI for all contracts |
| `/v3/snapshot/options/{underlying}/{contract}` | GET | **Single contract snapshot** — same fields for one contract |
| `/v3/reference/options/contracts` | GET | **Contract reference** — list all contracts (active/expired) for a ticker |
| `/v3/reference/options/contracts/{ticker}` | GET | **Single contract reference** — metadata for one contract |

Additional endpoints (trades, quotes, aggregates):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v3/trades/{optionsTicker}` | GET | Historical trades for an options contract |
| `/v3/quotes/{optionsTicker}` | GET | Historical quotes for an options contract |
| `/v2/aggs/ticker/{optionsTicker}/range/...` | GET | OHLC aggregates for an options contract |
| `/v2/aggs/ticker/{optionsTicker}/prev` | GET | Previous day OHLC |

### Options Ticker Symbol Format

Polygon uses the OCC symbology with an `O:` prefix:

```
O:{UNDERLYING}{YYMMDD}{C|P}{PRICE_WITH_3_DECIMALS}

Examples:
  O:AAPL260418C00175000  →  AAPL, April 18 2026, Call, $175.00
  O:TSLA260320P00850000  →  TSLA, March 20 2026, Put, $850.00

Strike price encoding: multiply by 1000, pad to 8 digits
  $175.00  →  00175000
  $52.50   →  00052500
  $1200.00 →  01200000
```

### Chain Snapshot — Primary Endpoint

```
GET /v3/snapshot/options/{underlyingAsset}
```

**Query parameters for filtering:**

| Parameter | Description |
|-----------|-------------|
| `contract_type` | `call` or `put` |
| `expiration_date` | Exact: `YYYY-MM-DD` |
| `expiration_date.gte` | Expiry on or after date |
| `expiration_date.lte` | Expiry on or before date |
| `strike_price` | Exact strike |
| `strike_price.gte` | Strike at or above |
| `strike_price.lte` | Strike at or below |
| `limit` | Results per page (max 250, default 10) |
| `sort` | Field to sort by |
| `order` | `asc` or `desc` |

**Response fields per contract:**

```json
{
  "break_even_price": 182.50,
  "day": {
    "change": 0.45,
    "change_percent": 2.1,
    "close": 7.50,
    "high": 7.80,
    "low": 6.90,
    "open": 7.10,
    "previous_close": 7.05,
    "volume": 1250,
    "vwap": 7.35,
    "last_updated": 1711036800000000000
  },
  "details": {
    "contract_type": "call",
    "exercise_style": "american",
    "expiration_date": "2026-04-18",
    "shares_per_contract": 100,
    "strike_price": 175.0,
    "ticker": "O:AAPL260418C00175000"
  },
  "greeks": {
    "delta": 0.42,
    "gamma": 0.035,
    "theta": -0.12,
    "vega": 0.28
  },
  "implied_volatility": 0.32,
  "last_quote": {
    "ask": 7.60,
    "ask_size": 15,
    "bid": 7.40,
    "bid_size": 20,
    "midpoint": 7.50,
    "last_updated": 1711036800000000000
  },
  "last_trade": {
    "price": 7.50,
    "size": 5,
    "sip_timestamp": 1711036800000000000
  },
  "open_interest": 3450,
  "underlying_asset": {
    "change_to_break_even": 10.50,
    "price": 172.00,
    "ticker": "AAPL",
    "last_updated": 1711036800000000000
  }
}
```

### Practical API Usage Pattern

```typescript
// Step 1: Fetch candidate contracts for a coach recommendation
async function fetchCandidateContracts(
  ticker: string,
  direction: 'long' | 'short',
  currentPrice: number,
  projectedDate: string  // YYYY-MM-DD
): Promise<OptionContract[]> {
  const contractType = direction === 'long' ? 'call' : 'put';

  // Expiration window: projected date + 14 days to projected date + 90 days
  const minExpiry = addDays(projectedDate, 14);
  const maxExpiry = addDays(projectedDate, 90);

  // Strike window: for calls, from 10% below current to 5% above target
  // For puts, from 5% below target to 10% above current
  const strikeLow = direction === 'long'
    ? currentPrice * 0.90
    : targetPrice * 0.95;
  const strikeHigh = direction === 'long'
    ? targetPrice * 1.05
    : currentPrice * 1.10;

  const response = await fetch(
    `https://api.polygon.io/v3/snapshot/options/${ticker}?` +
    `contract_type=${contractType}&` +
    `expiration_date.gte=${minExpiry}&` +
    `expiration_date.lte=${maxExpiry}&` +
    `strike_price.gte=${strikeLow}&` +
    `strike_price.lte=${strikeHigh}&` +
    `limit=250&` +
    `apiKey=${POLYGON_API_KEY}`
  );

  const data = await response.json();
  return data.results;
}

// Step 2: Paginate if needed (follow next_url)
// Step 3: Filter with Phase 2 rules
// Step 4: Score and rank with composite model
// Step 5: Return top 5-10 candidates with scenario analysis
```

### API Plan Requirements

| Feature | Starter | Developer | Advanced | Business |
|---------|---------|-----------|----------|----------|
| Chain snapshot | Yes | Yes | Yes | Yes |
| Greeks | Yes | Yes | Yes | Yes |
| IV | Yes | Yes | Yes | Yes |
| Fair Market Value (fmv) | No | No | No | Yes |
| Real-time quotes | No | Delayed | Delayed | Real-time |
| Rate limit | 5/min | 100+/min | Higher | Highest |

For this use case, Developer plan or above is recommended for reasonable rate limits and delayed quote access.

---

## 8. Implementation Notes

### Phased Build Plan

**Phase 1 (MVP — intrinsic value only):**
- Fetch options chain from Polygon for a given ticker/direction/date range
- Calculate intrinsic ROI at target price for each contract
- Filter by basic liquidity (OI > 50, spread < 20%)
- Sort by ROI, display top 5
- Display: strike, expiry, ask, estimated value at target, ROI%
- No Greeks needed (simplifies API usage)

**Phase 2 (add Greeks intelligence):**
- Add delta filtering (0.20-0.70 range, prefer 0.25-0.40)
- Add theta display (daily decay in dollars)
- Add expiration window enforcement (projected + 14d to + 90d)
- Composite scoring with weighted rank
- Display: all Phase 1 fields + delta, theta, composite score
- Flag contracts where IV seems elevated (compare across strikes)

**Phase 3 (full pricing model):**
- Black-Scholes forward valuation (estimate option price at target with remaining time)
- Scenario analysis (stop loss, no move, 50%, 75%, target, target+5%)
- IV rank tracking (store daily snapshots, compute rank over time)
- Position sizing calculator (Kelly-derived)
- Display: scenario table per contract, risk/reward visualization

### Data Flow in Coachtrack

```
ParsedTrade (ticker, target, date, direction)
  → Options Chain fetch (Polygon API)
    → Filter (delta, expiry, liquidity)
      → Score & Rank (composite model)
        → Display top candidates in Ticker Detail view
          → User selects contract → ActiveTrade record updated with contract details
```

### Caching Strategy

- Options chain data: cache for 60 seconds during market hours, 5 minutes outside
- Greeks change with stock price, so cache invalidation should be tied to price updates
- Contract reference data (strikes, expiries available): cache for 24 hours
- Rate limit budget: reserve 60% for price monitoring, 40% for options chain refreshes

### Edge Cases

- **Very short-dated coach projections** (< 7 days): Phase 2 filters may exclude all contracts. Fall back to weeklies with relaxed expiry rules but add a warning.
- **Very long-dated projections** (> 6 months): LEAPS territory. Theta matters less, delta matters more. Adjust ideal delta range upward (0.40-0.60).
- **Low-liquidity underlyings:** Some tickers have very thin options markets. If no contracts pass liquidity filters, relax gradually and add warnings.
- **Earnings dates:** If an earnings date falls between now and projected date, IV will be elevated. This is expected -- don't penalize it, but note it.
- **Dividends:** Ex-dividend dates affect call pricing. For significant dividends, note the impact.
- **Short direction puts:** Same framework applies. Puts gain intrinsic value as stock drops. All formulas work with `contractType = 'put'`.

### Future Considerations (Beyond v1)

- **Probability of profit (POP):** More accurate than delta as a probability proxy. POP = probability that the option's value at expiry exceeds the premium paid. Requires Monte Carlo simulation or numerical integration.
- **Expected value calculation:** `EV = (probability of profit * average gain) - (probability of loss * average loss)`. More robust than ROI alone.
- **Greeks-based P&L attribution:** Break down expected return into delta P&L, theta cost, vega exposure, and gamma convexity.
- **Multi-leg strategies:** Vertical spreads reduce cost and define risk further. A bull call spread (buy lower strike, sell higher strike) caps upside but dramatically reduces theta cost.
- **Coach accuracy tracking:** Over time, track what % of coach targets are hit and by when. Use this to refine the probability estimates and Kelly sizing.

---

## Sources

- [Polygon.io Options Chain Snapshot API](https://massive.com/docs/rest/options/snapshots/option-chain-snapshot)
- [Polygon.io Option Contract Snapshot API](https://massive.com/docs/rest/options/snapshots/option-contract-snapshot)
- [Polygon.io All Contracts Reference API](https://massive.com/docs/rest/options/contracts/all-contracts)
- [How to Read an Options Symbol — Polygon](https://massive.com/knowledge-base/article/how-do-you-read-an-options-symbol)
- [Options Delta Explained — QuantWheel](https://quantwheel.com/learn/options-delta-explained/)
- [Why 30 Delta Is the Best Option — AI Trading Strategies](https://ai.hubb.com/why-30-delta-is-the-best-option/)
- [Theta Decay DTE Guide — DaysToExpiry](https://www.daystoexpiry.com/blog/theta-decay-dte-guide)
- [Optimal Expiration Dates and Strike Prices — OptionsPlay](https://www.optionsplay.com/blogs/optimal-expiration-dates-and-strike-prices)
- [IV Rank and IV Percentile — Option Samurai](https://optionsamurai.com/blog/implied-volatility-percentile-iv-percentile/)
- [Using Implied Volatility Percentiles — Schwab](https://www.schwab.com/learn/story/using-implied-volatility-percentiles)
- [Kelly Criterion — Wikipedia](https://en.wikipedia.org/wiki/Kelly_criterion)
- [Kelly Criterion Position Sizing — QuantifiedStrategies](https://www.quantifiedstrategies.com/kelly-criterion-position-sizing/)
- [Options Probabilities Explained — TradeOptionsWithMe](https://tradeoptionswithme.com/options-probabilities-explained/)
- [Options Delta and Probability — Schwab](https://www.schwab.com/learn/story/options-delta-probability-and-other-risk-analytics)
- [Black-Scholes Model — Wikipedia](https://en.wikipedia.org/wiki/Black%E2%80%93Scholes_model)
- [black-scholes npm package](https://www.npmjs.com/package/black-scholes)
- [Option Pricing in JavaScript — Scribbler](https://scribbler.live/2023/04/06/Option-Pricing-using-Black-Scholes-in-JavaScript.html)
- [Selecting Strike Price and Expiration — Fidelity](https://www.fidelity.com/learning-center/investment-products/options/selecting-strike-price-expiration-date)
- [The Options Landscape for Hedge Funds — Hedge Fund Journal](https://thehedgefundjournal.com/the-options-landscape-for-hedge-funds/)
