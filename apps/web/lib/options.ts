// Options Finder — Phase 1: Intrinsic Value ROI Ranking
// Types, calculations, filtering, enrichment

// ── Types ──────────────────────────────────────────────────────────────────────

export type RiskTolerance = "high" | "medium" | "low";

export interface TradeInput {
  ticker: string;
  direction: "LONG" | "SHORT";
  currentPrice: number;
  priceTargetHigh: number;
  projectedDate: string; // ISO date
  stopLoss: number;
  coachNote?: string;
  hasCoachRec: boolean;
  riskTolerance?: RiskTolerance;
}

export interface CustomTradeInput extends TradeInput {
  hasCoachRec: false;
}

/** Raw contract from Polygon.io snapshot */
export interface RawContract {
  details: {
    contract_type: "call" | "put";
    exercise_style: string;
    expiration_date: string;
    shares_per_contract: number;
    strike_price: number;
    ticker: string;
  };
  day: {
    change: number;
    change_percent: number;
    close: number;
    high: number;
    low: number;
    open: number;
    previous_close: number;
    volume: number;
    vwap: number;
  } | null;
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
  } | null;
  implied_volatility?: number | null;
  last_quote: {
    ask: number;
    ask_size: number;
    bid: number;
    bid_size: number;
    midpoint: number;
  } | null;
  open_interest: number;
  break_even_price?: number;
  underlying_asset?: {
    price: number;
    ticker: string;
  } | null;
}

/** Enriched contract with computed fields */
export interface EnrichedContract {
  id: string;
  strike: number;
  expiry: string;
  ask: number;
  bid: number;
  openInterest: number;
  contractType: "call" | "put";
  // Phase 1 — Intrinsic
  roi: number;       // intrinsic-only ROI (kept for comparison)
  breakeven: number;
  estValue: number;   // intrinsic value at target
  spread: number;
  dte: number;
  moneyness: "ITM" | "ATM" | "OTM";
  isSweetSpot: boolean;
  // Phase 2 — Greeks + Composite
  delta: number;
  gamma: number;
  theta: number;  // daily
  iv: number;     // implied volatility (decimal, e.g. 0.35 = 35%)
  compositeScore: number; // 0-1 weighted blend
  scoreBreakdown: { roi: number; delta: number; theta: number; liquidity: number; iv: number }; // individual 0-1 scores
  // Phase 3 — Forward Pricing + Scenarios
  forwardValue: number;   // BS-estimated option value at target (with time value)
  forwardROI: number;     // ROI using forward value instead of intrinsic
  scenarios: ScenarioResult[]; // 5-point scenario analysis
}

export type SortMode = "roi" | "premium" | "expiry" | "score";

// ── Calculations ───────────────────────────────────────────────────────────────

export function calcROI(
  strike: number,
  ask: number,
  targetPrice: number,
  contractType: "call" | "put"
): number {
  const intrinsic =
    contractType === "call"
      ? Math.max(0, targetPrice - strike)
      : Math.max(0, strike - targetPrice);
  return ((intrinsic - ask) / ask) * 100;
}

export function calcBreakeven(
  strike: number,
  ask: number,
  contractType: "call" | "put"
): number {
  return contractType === "call" ? strike + ask : strike - ask;
}

export function calcEstValue(
  strike: number,
  targetPrice: number,
  contractType: "call" | "put"
): number {
  return contractType === "call"
    ? Math.max(0, targetPrice - strike)
    : Math.max(0, strike - targetPrice);
}

export function spreadPct(bid: number, ask: number): number {
  const mid = (bid + ask) / 2;
  if (mid === 0) return 0;
  return ((ask - bid) / mid) * 100;
}

export function moneynessLabel(
  strike: number,
  currentPrice: number,
  contractType: "call" | "put"
): "ITM" | "ATM" | "OTM" {
  const diff = Math.abs(strike - currentPrice);
  // ATM if within 0.5% of current price
  if (diff / currentPrice < 0.005) return "ATM";
  if (contractType === "call") {
    return strike < currentPrice ? "ITM" : "OTM";
  }
  return strike > currentPrice ? "ITM" : "OTM";
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Black-Scholes + Greeks ────────────────────────────────────────────────────

/** Cumulative standard normal distribution (rational approximation) */
function cdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * ax);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

/** Standard normal probability density function */
function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

const RISK_FREE_RATE = 0.045; // ~4.5% US T-bill rate

export function blackScholesCall(
  S: number, K: number, T: number, r: number, sigma: number
): number {
  if (T <= 0) return Math.max(0, S - K);
  if (sigma <= 0) return Math.max(0, S - K * Math.exp(-r * T));
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
}

export function blackScholesPut(
  S: number, K: number, T: number, r: number, sigma: number
): number {
  if (T <= 0) return Math.max(0, K - S);
  if (sigma <= 0) return Math.max(0, K * Math.exp(-r * T) - S);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
}

export function blackScholes(
  S: number, K: number, T: number, r: number, sigma: number,
  type: "call" | "put"
): number {
  return type === "call"
    ? blackScholesCall(S, K, T, r, sigma)
    : blackScholesPut(S, K, T, r, sigma);
}

/** Compute d1 for Greeks derivation */
function bsD1(S: number, K: number, T: number, r: number, sigma: number): number {
  return (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
}

export interface GreeksResult {
  delta: number;
  gamma: number;
  theta: number; // daily (negative for long options)
  iv: number;    // implied volatility used
}

/** Compute Greeks from BS model */
export function computeGreeks(
  S: number, K: number, T: number, sigma: number,
  type: "call" | "put"
): GreeksResult {
  const r = RISK_FREE_RATE;
  if (T <= 0 || sigma <= 0) {
    // At expiry: delta is 1 or 0, no gamma/theta
    const itm = type === "call" ? S > K : K > S;
    return { delta: itm ? (type === "call" ? 1 : -1) : 0, gamma: 0, theta: 0, iv: sigma };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = bsD1(S, K, T, r, sigma);
  const d2 = d1 - sigma * sqrtT;
  const pdfD1 = pdf(d1);

  // Delta
  const delta = type === "call" ? cdf(d1) : cdf(d1) - 1;

  // Gamma (same for calls and puts)
  const gamma = pdfD1 / (S * sigma * sqrtT);

  // Theta (annualized, then convert to daily)
  const term1 = -(S * pdfD1 * sigma) / (2 * sqrtT);
  let thetaAnnual: number;
  if (type === "call") {
    thetaAnnual = term1 - r * K * Math.exp(-r * T) * cdf(d2);
  } else {
    thetaAnnual = term1 + r * K * Math.exp(-r * T) * cdf(-d2);
  }
  const thetaDaily = thetaAnnual / 365;

  return { delta, gamma, theta: thetaDaily, iv: sigma };
}

/**
 * Estimate implied volatility from market price using Newton-Raphson.
 * Falls back to a reasonable default if convergence fails.
 */
export function estimateIV(
  marketPrice: number, S: number, K: number, T: number,
  type: "call" | "put"
): number {
  if (T <= 0 || marketPrice <= 0) return 0.30; // default 30%

  const r = RISK_FREE_RATE;
  let sigma = 0.30; // initial guess

  for (let i = 0; i < 50; i++) {
    const price = blackScholes(S, K, T, r, sigma, type);
    const diff = price - marketPrice;

    if (Math.abs(diff) < 0.001) return sigma;

    // Vega = S * sqrt(T) * pdf(d1)
    const d1 = bsD1(S, K, T, r, sigma);
    const vega = S * Math.sqrt(T) * pdf(d1);

    if (vega < 0.0001) break; // avoid division by near-zero

    sigma -= diff / vega;
    sigma = Math.max(0.01, Math.min(sigma, 5.0)); // clamp to reasonable range
  }

  return sigma;
}

// ── Composite Scoring (Phase 2) ──────────────────────────────────────────────

// ── Unified Risk Configuration ────────────────────────────────────────────────
// Single source of truth for all risk-dependent behavior across:
//   1. Polygon fetch (strike/expiry windows)
//   2. Filtering (OI, spread, DTE thresholds)
//   3. Scoring (weights, ROI scaling, delta center)
//   4. Candidate selection (ATM vs OTM distribution)
//
// When tuning risk behavior, edit ONLY this object.

interface RiskConfig {
  // Fetch: how wide to cast the Polygon API net
  fetch: {
    expiryOffsetDays: number;   // min expiry = projectedDate + N days
    strikePadLow: number;       // multiply lower bound (0.80 = 20% below)
    strikePadHigh: number;      // multiply upper bound (1.15 = 15% above)
    candidateCount: number;     // max contracts to price
  };
  // Candidate selection: distribution across strike zones
  candidates: {
    nearATMPct: number;         // % of picks near ATM (≤3% from current)
    slightlyOTMPct: number;     // % of picks slightly OTM (3-8% from current)
    // remainder goes to moderately OTM (>8% from current)
  };
  // Filtering: post-fetch thresholds
  filters: FilterConfig;
  // Scoring: composite weight distribution
  weights: { roi: number; delta: number; theta: number; liquidity: number; iv: number };
}

export const RISK_CONFIG: Record<RiskTolerance, RiskConfig> = {
  high: {
    fetch: { expiryOffsetDays: 0, strikePadLow: 0.80, strikePadHigh: 1.15, candidateCount: 25 },
    candidates: { nearATMPct: 0.15, slightlyOTMPct: 0.30 },
    filters: { minOpenInterest: 0, maxSpreadPct: 50, minDtePastProjected: 0 },
    weights: { roi: 0.75, delta: 0.05, theta: 0.05, liquidity: 0.05, iv: 0.10 },
  },
  medium: {
    fetch: { expiryOffsetDays: 14, strikePadLow: 0.90, strikePadHigh: 1.05, candidateCount: 15 },
    candidates: { nearATMPct: 0.40, slightlyOTMPct: 0.35 },
    filters: { minOpenInterest: 1, maxSpreadPct: 20, minDtePastProjected: 14 },
    weights: { roi: 0.35, delta: 0.20, theta: 0.15, liquidity: 0.15, iv: 0.15 },
  },
  low: {
    fetch: { expiryOffsetDays: 21, strikePadLow: 0.95, strikePadHigh: 1.03, candidateCount: 15 },
    candidates: { nearATMPct: 0.55, slightlyOTMPct: 0.30 },
    filters: { minOpenInterest: 10, maxSpreadPct: 10, minDtePastProjected: 21 },
    weights: { roi: 0.20, delta: 0.30, theta: 0.15, liquidity: 0.20, iv: 0.15 },
  },
};

/** ROI score: cap scales with risk tolerance so high-risk surfaces lottery tickets */
function roiScore(roi: number, risk: RiskTolerance = "medium"): number {
  if (roi <= 0) return 0;
  // High risk: log scale so 17,000% clearly beats 500%, but doesn't go infinite
  // Medium: linear cap at 500%
  // Low: linear cap at 200% (conservative — diminishing returns past 200%)
  if (risk === "high") {
    // log10(500) ≈ 2.7, log10(17000) ≈ 4.23 — gives clear separation
    return Math.min(Math.log10(roi + 1) / Math.log10(50001), 1.0);
  }
  const cap = risk === "low" ? 200 : 500;
  return Math.min(roi / cap, 1.0);
}

/** Delta score: ideal center shifts with risk tolerance */
function deltaScore(absDelta: number, risk: RiskTolerance = "medium"): number {
  if (risk === "high") {
    // High risk: no penalty for low delta — all deltas are fine, slight
    // preference for lower (more leverage). Score never drops below 0.5.
    return Math.max(0.5, 1.0 - absDelta * 0.5);
  }
  // Low risk: favor ITM (higher delta ~0.55), Medium: balanced at 0.35
  const idealCenter = risk === "low" ? 0.55 : 0.35;
  const distance = Math.abs(absDelta - idealCenter);
  return Math.max(0, 1.0 - distance / 0.35);
}

/** Theta score: lower daily decay per dollar invested is better */
function thetaScore(theta: number, askPrice: number): number {
  if (askPrice <= 0) return 0;
  const thetaPerDollar = Math.abs(theta) / askPrice;
  return Math.max(0, 1.0 - thetaPerDollar / 0.05);
}

/** Liquidity score: tighter spread + higher OI */
function liquidityScore(bid: number, ask: number, openInterest: number): number {
  const mid = (bid + ask) / 2;
  const spreadScore = mid > 0 ? Math.max(0, 1.0 - (ask - bid) / mid / 0.15) : 0;
  const oiScore = Math.min(openInterest / 1000, 1.0);
  return spreadScore * 0.6 + oiScore * 0.4;
}

/** IV score: lower IV relative to a baseline is cheaper (better for buyers) */
function ivScore(iv: number): number {
  // Without historical IV rank, score based on absolute IV level
  // <20% = cheap, 20-40% = normal, >60% = expensive
  if (iv <= 0.20) return 1.0;
  if (iv >= 0.80) return 0.0;
  return Math.max(0, 1.0 - (iv - 0.20) / 0.60);
}

export function computeCompositeScore(
  roi: number, delta: number, theta: number, ask: number,
  bid: number, openInterest: number, iv: number,
  riskTolerance: RiskTolerance = "medium"
): number {
  const w = RISK_CONFIG[riskTolerance].weights;
  return (
    w.roi * roiScore(roi, riskTolerance) +
    w.delta * deltaScore(Math.abs(delta), riskTolerance) +
    w.theta * thetaScore(theta, ask) +
    w.liquidity * liquidityScore(bid, ask, openInterest) +
    w.iv * ivScore(iv)
  );
}

// ── Phase 3: Forward Pricing + Scenario Analysis ─────────────────────────────

/**
 * Estimate what an option will be worth at a future stock price with
 * remaining time value. Uses BS with S=futureStockPrice, T=time remaining
 * after the projected date until expiry.
 *
 * This is the core Phase 3 upgrade over Phase 1's intrinsic-only estimate:
 * - Captures remaining time value (longer-dated options worth more)
 * - Accounts for how far ITM the option is at target
 * - Uses current IV to model the uncertainty premium
 */
export function estimateValueAtTarget(
  futureStockPrice: number,
  strike: number,
  expiryDate: string,
  projectedDate: string,
  iv: number,
  type: "call" | "put"
): number {
  // T = remaining time from projected date to expiration, in years
  const expiryMs = new Date(expiryDate + "T00:00:00").getTime();
  const projMs = new Date(projectedDate + "T00:00:00").getTime();
  const remainingDays = (expiryMs - projMs) / (1000 * 60 * 60 * 24);
  const T = remainingDays / 365;

  if (T <= 0) {
    // Option expires on or before projected date — intrinsic only
    return type === "call"
      ? Math.max(0, futureStockPrice - strike)
      : Math.max(0, strike - futureStockPrice);
  }

  // BS with S = future stock price, T = remaining time after target hit
  return blackScholes(futureStockPrice, strike, T, RISK_FREE_RATE, iv, type);
}

/** Forward ROI: (estimated future option value - current premium) / current premium */
export function calcForwardROI(
  strike: number,
  ask: number,
  targetPrice: number,
  expiryDate: string,
  projectedDate: string,
  iv: number,
  type: "call" | "put"
): number {
  const futureValue = estimateValueAtTarget(
    targetPrice, strike, expiryDate, projectedDate, iv, type
  );
  if (ask <= 0) return 0;
  return ((futureValue - ask) / ask) * 100;
}

/** A single scenario outcome for a contract */
export interface ScenarioResult {
  label: string;
  stockPrice: number;
  optionValue: number;
  roi: number; // percentage
}

/**
 * Run 5 price scenarios through BS forward-pricing to show the user
 * what happens to their option at different stock outcomes.
 */
export function runScenarios(
  currentPrice: number,
  targetPrice: number,
  strike: number,
  ask: number,
  expiryDate: string,
  projectedDate: string,
  iv: number,
  type: "call" | "put"
): ScenarioResult[] {
  // For shorts, the "move" goes downward (target < current)
  const move = targetPrice - currentPrice;

  const scenarios = [
    { label: "No move", price: currentPrice },
    { label: "25%", price: currentPrice + move * 0.25 },
    { label: "50%", price: currentPrice + move * 0.5 },
    { label: "75%", price: currentPrice + move * 0.75 },
    { label: "Target", price: targetPrice },
  ];

  return scenarios.map((s) => {
    const optionValue = estimateValueAtTarget(
      s.price, strike, expiryDate, projectedDate, iv, type
    );
    const roi = ask > 0 ? ((optionValue - ask) / ask) * 100 : 0;
    return {
      label: s.label,
      stockPrice: Math.round(s.price * 100) / 100,
      optionValue: Math.round(optionValue * 100) / 100,
      roi: Math.round(roi * 10) / 10,
    };
  });
}

// ── Filtering ──────────────────────────────────────────────────────────────────

export interface FilterConfig {
  minOpenInterest: number;
  maxSpreadPct: number;
  minDtePastProjected: number;
}

export const DEFAULT_FILTERS: FilterConfig = {
  minOpenInterest: 1, // Relaxed: using prev-close volume as OI proxy
  maxSpreadPct: 20,
  minDtePastProjected: 14,
};

export function filterContracts(
  contracts: RawContract[],
  trade: TradeInput,
  filters: FilterConfig = DEFAULT_FILTERS,
  riskTolerance: RiskTolerance = "medium"
): RawContract[] {
  const effectiveFilters = RISK_CONFIG[riskTolerance].filters;
  const expectedType = trade.direction === "LONG" ? "call" : "put";
  const projectedDte = daysUntil(trade.projectedDate);
  const minDte = projectedDte + effectiveFilters.minDtePastProjected;

  return contracts.filter((c) => {
    // Must be correct contract type
    if (c.details.contract_type !== expectedType) return false;

    // Must have valid quote
    if (!c.last_quote || c.last_quote.ask <= 0) return false;

    // Expiry at least N days past projected date
    const dte = daysUntil(c.details.expiration_date);
    if (dte < minDte) return false;

    // Open interest threshold
    if (c.open_interest < effectiveFilters.minOpenInterest) return false;

    // Bid-ask spread
    const spread = spreadPct(c.last_quote.bid, c.last_quote.ask);
    if (spread > effectiveFilters.maxSpreadPct) return false;

    return true;
  });
}

// ── Enrichment ─────────────────────────────────────────────────────────────────

export function enrichContracts(
  contracts: RawContract[],
  trade: TradeInput,
  riskTolerance: RiskTolerance = "medium"
): EnrichedContract[] {
  const enriched = contracts.map((c): EnrichedContract => {
    const strike = c.details.strike_price;
    const ask = c.last_quote!.ask;
    const bid = c.last_quote!.bid;
    const mid = c.last_quote!.midpoint || (ask + bid) / 2;
    const oi = c.open_interest;
    const type = c.details.contract_type;
    const dte = daysUntil(c.details.expiration_date);
    const T = Math.max(dte / 365, 0.001); // time to expiry in years

    // Phase 2: Estimate IV from market price, then compute Greeks
    const iv = estimateIV(mid, trade.currentPrice, strike, T, type);
    const greeks = computeGreeks(trade.currentPrice, strike, T, iv, type);

    const roi = calcROI(strike, ask, trade.priceTargetHigh, type);

    // Phase 3: Forward pricing — BS with time value at projected date
    const fwdValue = estimateValueAtTarget(
      trade.priceTargetHigh, strike, c.details.expiration_date,
      trade.projectedDate, iv, type
    );
    const fwdROI = ask > 0 ? ((fwdValue - ask) / ask) * 100 : 0;
    const scenarios = runScenarios(
      trade.currentPrice, trade.priceTargetHigh, strike, ask,
      c.details.expiration_date, trade.projectedDate, iv, type
    );

    // Phase 3: Score uses forward ROI (captures time value) instead of intrinsic
    const score = computeCompositeScore(
      fwdROI, greeks.delta, greeks.theta, ask, bid, oi, iv, riskTolerance
    );

    return {
      id: c.details.ticker,
      strike,
      expiry: c.details.expiration_date,
      ask,
      bid,
      openInterest: oi,
      contractType: type,
      roi,
      breakeven: calcBreakeven(strike, ask, type),
      estValue: calcEstValue(strike, trade.priceTargetHigh, type),
      spread: spreadPct(bid, ask),
      dte,
      moneyness: moneynessLabel(strike, trade.currentPrice, type),
      isSweetSpot: false, // computed below
      delta: greeks.delta,
      gamma: greeks.gamma,
      theta: greeks.theta,
      iv,
      compositeScore: score,
      scoreBreakdown: {
        roi: roiScore(fwdROI, riskTolerance),
        delta: deltaScore(Math.abs(greeks.delta), riskTolerance),
        theta: thetaScore(greeks.theta, ask),
        liquidity: liquidityScore(bid, ask, oi),
        iv: ivScore(iv),
      },
      forwardValue: Math.round(fwdValue * 100) / 100,
      forwardROI: Math.round(fwdROI * 10) / 10,
      scenarios,
    };
  });

  // Sort by composite score descending (Phase 2 default)
  enriched.sort((a, b) => b.compositeScore - a.compositeScore);

  // Detect sweet spot using composite score
  markSweetSpot(enriched, riskTolerance);

  return enriched;
}

function markSweetSpot(contracts: EnrichedContract[], riskTolerance: RiskTolerance = "medium"): void {
  if (contracts.length === 0) return;

  // Delta range shifts with risk tolerance
  const minDelta = riskTolerance === "high" ? 0.05 : riskTolerance === "low" ? 0.30 : 0.15;
  const maxDelta = riskTolerance === "high" ? 0.50 : riskTolerance === "low" ? 0.90 : 0.75;

  let bestIdx = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < contracts.length; i++) {
    const c = contracts[i];
    const absDelta = Math.abs(c.delta);

    if (c.roi <= 0) continue;
    if (absDelta < minDelta || absDelta > maxDelta) continue;
    if (c.spread >= 15) continue;

    if (c.compositeScore > bestScore) {
      bestScore = c.compositeScore;
      bestIdx = i;
    }
  }

  if (bestIdx >= 0) {
    contracts[bestIdx].isSweetSpot = true;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Sorting ────────────────────────────────────────────────────────────────────

export function sortContracts(
  contracts: EnrichedContract[],
  sortBy: SortMode
): EnrichedContract[] {
  const sorted = [...contracts];
  switch (sortBy) {
    case "score":
      sorted.sort((a, b) => b.compositeScore - a.compositeScore);
      break;
    case "roi":
      sorted.sort((a, b) => b.roi - a.roi);
      break;
    case "premium":
      sorted.sort((a, b) => a.ask - b.ask);
      break;
    case "expiry":
      sorted.sort((a, b) => a.dte - b.dte);
      break;
  }
  return sorted;
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

export function formatMoney(val: number): string {
  return "$" + val.toFixed(2);
}

export function formatPct(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return sign + val.toFixed(1) + "%";
}

export function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  return months[parseInt(parts[1], 10) - 1] + " " + parseInt(parts[2], 10);
}

// ── Pipeline: single entry point for the full options chain ───────────────────
// Accepts trade + risk once; threads risk through fetch → filter → enrich.
// This prevents risk tolerance from being accidentally dropped at any stage.

export interface PipelineResult {
  contracts: EnrichedContract[];
  totalRaw: number;
  totalFiltered: number;
}

export async function runOptionsPipeline(
  trade: TradeInput,
  riskTolerance: RiskTolerance = "medium"
): Promise<PipelineResult> {
  const raw = await fetchOptionsChain(
    trade.ticker,
    trade.direction,
    trade.currentPrice,
    trade.projectedDate,
    trade.priceTargetHigh,
    riskTolerance
  );

  const filtered = filterContracts(raw, trade, DEFAULT_FILTERS, riskTolerance);
  const enriched = enrichContracts(filtered, trade, riskTolerance);

  return {
    contracts: enriched,
    totalRaw: raw.length,
    totalFiltered: filtered.length,
  };
}

// ── Polygon API fetch helpers (server-side) ────────────────────────────────────

const POLYGON_BASE = "https://api.polygon.io";

/** Reference contract from /v3/reference/options/contracts */
interface ContractRef {
  ticker: string; // e.g. "O:SPY260515C00570000"
  underlying_ticker: string;
  contract_type: "call" | "put";
  expiration_date: string;
  strike_price: number;
  exercise_style: string;
  shares_per_contract: number;
}

/**
 * Two-step fetch: contracts reference (available strikes) + prev-close prices.
 * Works on Polygon free/starter plans that don't have snapshot access.
 */
export async function fetchOptionsChain(
  ticker: string,
  direction: "LONG" | "SHORT",
  currentPrice: number,
  projectedDate: string,
  targetPrice?: number,
  riskTolerance: RiskTolerance = "medium"
): Promise<RawContract[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey || apiKey === "your-polygon-key") return [];

  const contractType = direction === "LONG" ? "call" : "put";

  const rc = RISK_CONFIG[riskTolerance].fetch;

  // Expiration window: risk-aware offset from projected date
  const projDate = new Date(projectedDate + "T00:00:00");
  const minExpiry = new Date(projDate.getTime() + rc.expiryOffsetDays * 86400000)
    .toISOString()
    .split("T")[0];
  const maxExpiry = new Date(projDate.getTime() + 90 * 86400000)
    .toISOString()
    .split("T")[0];

  // Strike window: risk-aware range around current price
  const effectiveTarget = targetPrice ?? currentPrice * (direction === "LONG" ? 1.15 : 0.85);
  const strikeLow = Math.floor(Math.min(currentPrice, effectiveTarget) * rc.strikePadLow);
  const strikeHigh = Math.ceil(Math.max(currentPrice, effectiveTarget) * rc.strikePadHigh);

  // Step 1: Get available contracts from reference endpoint (cached 30min)
  const refs = await fetchContractRefs(
    ticker, contractType, strikeLow, strikeHigh, minExpiry, maxExpiry, apiKey
  );

  // If Polygon is unavailable, generate synthetic contracts from BS model
  if (refs.length === 0) {
    console.log(`[Options] Polygon unavailable, generating synthetic contracts for ${ticker}`);
    return generateSyntheticContracts(ticker, contractType, currentPrice, strikeLow, strikeHigh, minExpiry, maxExpiry, riskTolerance);
  }

  // Step 2: Narrow down to the most interesting contracts
  const pricingCandidates = selectPricingCandidates(refs, currentPrice, rc.candidateCount, riskTolerance);

  // Step 3: Try real prices first, fall back to Black-Scholes
  const contracts = await fetchContractPrices(pricingCandidates, apiKey, currentPrice);

  // Mix in BS estimates for any candidates that didn't get real prices
  if (contracts.length < pricingCandidates.length) {
    const gotTickers = new Set(contracts.map((c) => c.details.ticker));
    const missing = pricingCandidates.filter((ref) => !gotTickers.has(ref.ticker));
    if (missing.length > 0) {
      console.log(`[Options] ${contracts.length} real prices, ${missing.length} BS estimates for ${ticker}`);
      contracts.push(...missing.map((ref) => buildBSContract(ref, currentPrice)));
    }
  }

  return contracts;
}

async function fetchContractRefs(
  ticker: string,
  contractType: string,
  strikeLow: number,
  strikeHigh: number,
  minExpiry: string,
  maxExpiry: string,
  apiKey: string
): Promise<ContractRef[]> {
  const url =
    `${POLYGON_BASE}/v3/reference/options/contracts?` +
    `underlying_ticker=${ticker.toUpperCase()}&` +
    `contract_type=${contractType}&` +
    `expiration_date.gte=${minExpiry}&` +
    `expiration_date.lte=${maxExpiry}&` +
    `strike_price.gte=${strikeLow}&` +
    `strike_price.lte=${strikeHigh}&` +
    `limit=250&` +
    `apiKey=${apiKey}`;

  try {
    const { ok, data } = await fetchPolygonCached(url);
    if (!ok) {
      console.warn(`[Options refs] failed for ${ticker}`);
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data as any).results ?? []) as ContractRef[];
  } catch (err) {
    console.warn("[Options refs] fetch error:", err);
    return [];
  }
}

/**
 * Select diverse contracts across strike ranges and expiry dates.
 * Spreads picks across near-ATM, slightly-OTM, and moderately-OTM strikes
 * at multiple expiry dates to give the composite scorer a good variety.
 */
function selectPricingCandidates(
  refs: ContractRef[],
  currentPrice: number,
  maxCount: number,
  riskTolerance: RiskTolerance = "medium"
): ContractRef[] {
  // Group by expiry, sorted chronologically
  const byExpiry = new Map<string, ContractRef[]>();
  for (const ref of refs) {
    const group = byExpiry.get(ref.expiration_date) ?? [];
    group.push(ref);
    byExpiry.set(ref.expiration_date, group);
  }

  const expiryDates = [...byExpiry.keys()].sort();
  // Pick up to 3 expiry dates (earliest, middle, latest) for variety
  const selectedExpiries: string[] = [];
  if (expiryDates.length <= 3) {
    selectedExpiries.push(...expiryDates);
  } else {
    selectedExpiries.push(expiryDates[0]);
    selectedExpiries.push(expiryDates[Math.floor(expiryDates.length / 2)]);
    selectedExpiries.push(expiryDates[expiryDates.length - 1]);
  }

  const strikesPerExpiry = Math.max(3, Math.floor(maxCount / selectedExpiries.length));
  const selected: ContractRef[] = [];

  for (const expiry of selectedExpiries) {
    const group = byExpiry.get(expiry) ?? [];

    // Sort by strike price
    const sorted = [...group].sort((a, b) => a.strike_price - b.strike_price);

    // Pick strikes in 3 zones: near-ATM, slightly OTM, moderately OTM
    const nearATM: ContractRef[] = [];
    const slightlyOTM: ContractRef[] = [];
    const modOTM: ContractRef[] = [];

    for (const ref of sorted) {
      const pctFromCurrent = (ref.strike_price - currentPrice) / currentPrice;
      const absPct = Math.abs(pctFromCurrent);
      if (absPct <= 0.03) nearATM.push(ref);
      else if (absPct <= 0.08) slightlyOTM.push(ref);
      else modOTM.push(ref);
    }

    // Distribute picks based on risk tolerance (from unified RISK_CONFIG)
    const { nearATMPct, slightlyOTMPct } = RISK_CONFIG[riskTolerance].candidates;
    const nearCount = Math.max(1, Math.round(strikesPerExpiry * nearATMPct));
    const slightCount = Math.max(1, Math.round(strikesPerExpiry * slightlyOTMPct));
    const modCount = Math.max(1, strikesPerExpiry - nearCount - slightCount);

    selected.push(...nearATM.slice(0, nearCount));
    selected.push(...slightlyOTM.slice(0, slightCount));
    selected.push(...modOTM.slice(0, modCount));
  }

  // Dedupe by ticker
  const seen = new Set<string>();
  const deduped = selected.filter((ref) => {
    if (seen.has(ref.ticker)) return false;
    seen.add(ref.ticker);
    return true;
  });

  return deduped.slice(0, maxCount);
}

/** In-memory cache for Polygon API responses (TTL-based) */
const polygonCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — Polygon free plan rate limits aggressively

async function fetchPolygonCached(url: string): Promise<{ ok: boolean; data: unknown }> {
  const cached = polygonCache.get(url);
  if (cached && cached.expiry > Date.now()) {
    return { ok: true, data: cached.data };
  }

  // Single attempt with 8s timeout — don't block the UI with long retries
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 429) {
      console.warn("[Options] Rate limited by Polygon");
      return { ok: false, data: null };
    }
    if (!res.ok) return { ok: false, data: null };
    const data = await res.json();
    polygonCache.set(url, { data, expiry: Date.now() + CACHE_TTL_MS });
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}

/** Build a contract using Black-Scholes when Polygon prices are unavailable */
function buildBSContract(ref: ContractRef, currentPrice: number): RawContract {
  const dte = daysUntil(ref.expiration_date);
  const T = Math.max(dte / 365, 0.001);
  const defaultIV = 0.35;
  let close = blackScholes(
    currentPrice, ref.strike_price, T, RISK_FREE_RATE, defaultIV,
    ref.contract_type
  );
  if (close < 0.01) close = 0.01;

  const estimatedSpread = close * 0.08;
  const bid = Math.max(0.01, close - estimatedSpread / 2);
  const ask = close + estimatedSpread / 2;

  return {
    details: {
      contract_type: ref.contract_type,
      exercise_style: ref.exercise_style,
      expiration_date: ref.expiration_date,
      shares_per_contract: ref.shares_per_contract,
      strike_price: ref.strike_price,
      ticker: ref.ticker,
    },
    day: {
      change: 0, change_percent: 0, close,
      high: close, low: close, open: close,
      previous_close: close, volume: 0, vwap: close,
    },
    greeks: null,
    implied_volatility: null,
    last_quote: {
      ask: Math.round(ask * 100) / 100,
      ask_size: 0,
      bid: Math.round(bid * 100) / 100,
      bid_size: 0,
      midpoint: close,
    },
    open_interest: 1,
    break_even_price: undefined,
    underlying_asset: null,
  };
}

/** Generate synthetic option contracts when Polygon is unavailable */
function generateSyntheticContracts(
  ticker: string,
  contractType: string,
  currentPrice: number,
  strikeLow: number,
  strikeHigh: number,
  minExpiry: string,
  maxExpiry: string,
  riskTolerance: RiskTolerance = "medium"
): RawContract[] {
  // Generate strikes at standard intervals ($1 for <$50, $5 for <$200, $10 for >$200)
  const strikeInterval = currentPrice < 50 ? 1 : currentPrice < 200 ? 5 : 10;
  const strikes: number[] = [];
  for (let s = Math.ceil(strikeLow / strikeInterval) * strikeInterval; s <= strikeHigh; s += strikeInterval) {
    strikes.push(s);
  }

  // Generate 3 expiry dates spread across the window
  const minDate = new Date(minExpiry + "T00:00:00");
  const maxDate = new Date(maxExpiry + "T00:00:00");
  const range = maxDate.getTime() - minDate.getTime();
  const expiries: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(minDate.getTime() + (range * (i + 1)) / 4);
    // Snap to next Friday
    const day = d.getDay();
    const daysToFri = (5 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + daysToFri);
    expiries.push(d.toISOString().split("T")[0]);
  }

  // Build refs and convert to contracts
  const refs: ContractRef[] = [];
  for (const expiry of expiries) {
    for (const strike of strikes) {
      const pad = String(strike * 1000).padStart(8, "0");
      const expStr = expiry.replace(/-/g, "").slice(2);
      const typeChar = contractType === "call" ? "C" : "P";
      refs.push({
        ticker: `O:${ticker}${expStr}${typeChar}${pad}`,
        contract_type: contractType as "call" | "put",
        exercise_style: "american",
        expiration_date: expiry,
        shares_per_contract: 100,
        strike_price: strike,
      });
    }
  }

  // Limit to diverse picks based on risk tolerance
  const rc = RISK_CONFIG[riskTolerance].fetch;
  const selected = selectPricingCandidates(refs, currentPrice, rc.candidateCount, riskTolerance);
  return selected.map((ref) => buildBSContract(ref, currentPrice));
}

async function fetchContractPrices(
  refs: ContractRef[],
  apiKey: string,
  currentPrice: number
): Promise<RawContract[]> {
  const results: RawContract[] = [];

  // Fetch sequentially to avoid Polygon rate limits on free plan
  for (const ref of refs) {
    const result = await fetchSingleContractPrice(ref, apiKey, currentPrice);
    if (result) results.push(result);
  }

  return results;
}

async function fetchSingleContractPrice(
  ref: ContractRef,
  apiKey: string,
  currentPrice: number
): Promise<RawContract | null> {
  try {
    const { ok, data } = await fetchPolygonCached(
      `${POLYGON_BASE}/v2/aggs/ticker/${ref.ticker}/prev?apiKey=${apiKey}`
    );
    if (!ok) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bar = (data as any).results?.[0];

    let close: number;
    let volume: number;

    if (bar) {
      close = bar.c as number;
      volume = (bar.v as number) ?? 0;
    } else {
      const dte = daysUntil(ref.expiration_date);
      const T = Math.max(dte / 365, 0.001);
      const defaultIV = 0.35;
      close = blackScholes(
        currentPrice, ref.strike_price, T, RISK_FREE_RATE, defaultIV,
        ref.contract_type
      );
      if (close < 0.01) close = 0.01;
      volume = 0;
    }

    const estimatedSpread = close * (volume > 100 ? 0.03 : 0.08);
    const bid = Math.max(0.01, close - estimatedSpread / 2);
    const ask = close + estimatedSpread / 2;

    return {
      details: {
        contract_type: ref.contract_type,
        exercise_style: ref.exercise_style,
        expiration_date: ref.expiration_date,
        shares_per_contract: ref.shares_per_contract,
        strike_price: ref.strike_price,
        ticker: ref.ticker,
      },
      day: {
        change: 0,
        change_percent: 0,
        close,
        high: bar ? (bar.h as number) ?? close : close,
        low: bar ? (bar.l as number) ?? close : close,
        open: bar ? (bar.o as number) ?? close : close,
        previous_close: close,
        volume,
        vwap: bar ? (bar.vw as number) ?? close : close,
      },
      greeks: null,
      implied_volatility: null,
      last_quote: {
        ask: Math.round(ask * 100) / 100,
        ask_size: 0,
        bid: Math.round(bid * 100) / 100,
        bid_size: 0,
        midpoint: close,
      },
      open_interest: Math.max(volume, 1),
      break_even_price: undefined,
      underlying_asset: null,
    };
  } catch {
    return null;
  }
}
