#!/usr/bin/env npx tsx
/**
 * Smoke test: verify that high/medium/low risk produce meaningfully different
 * results across filtering, scoring, and candidate selection.
 *
 * Run: npx tsx scripts/test-risk-pipeline.ts
 *
 * This catches regressions where risk tolerance is accidentally dropped from
 * any stage of the pipeline (fetch, filter, scoring, candidate selection).
 */

import {
  filterContracts,
  enrichContracts,
  computeCompositeScore,
  RISK_CONFIG,
  DEFAULT_FILTERS,
  type RawContract,
  type TradeInput,
  type RiskTolerance,
} from "../lib/options";

const RISKS: RiskTolerance[] = ["high", "medium", "low"];

// ── Test fixtures ─────────────────────────────────────────────────────────────

const trade: TradeInput = {
  ticker: "TEST",
  direction: "LONG",
  currentPrice: 100,
  priceTargetHigh: 120,
  projectedDate: futureDate(30), // 30 days out
  stopLoss: 90,
  hasCoachRec: false,
};

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function makeContract(
  strike: number,
  ask: number,
  bid: number,
  oi: number,
  dte: number
): RawContract {
  return {
    details: {
      contract_type: "call",
      exercise_style: "american",
      expiration_date: futureDate(dte),
      shares_per_contract: 100,
      strike_price: strike,
      ticker: `O:TEST${strike}C`,
    },
    open_interest: oi,
    day: null,
    last_quote: { ask, bid, midpoint: (ask + bid) / 2, ask_size: 10, bid_size: 10 },
  };
}

// Contracts spanning a range of risk profiles
const contracts: RawContract[] = [
  // Conservative: near-ATM, liquid, tight spread
  makeContract(102, 5.00, 4.80, 5000, 60),  // 4% spread, high OI
  makeContract(105, 3.50, 3.30, 3000, 60),  // 5.7% spread

  // Moderate: slightly OTM
  makeContract(110, 2.00, 1.80, 500, 50),   // 10% spread
  makeContract(115, 1.00, 0.80, 200, 50),   // 20% spread

  // Speculative: deep OTM, low liquidity, wide spread
  makeContract(125, 0.30, 0.10, 5, 45),     // 66% spread, 5 OI
  makeContract(130, 0.15, 0.02, 0, 35),     // 86% spread, 0 OI
  makeContract(135, 0.08, 0.01, 0, 30),     // 87% spread, 0 OI — near-term

  // Near-term expiry (before projected + 14d buffer)
  makeContract(108, 1.50, 1.30, 100, 35),   // 13% spread, expires before medium DTE
];

// ── Tests ─────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// Test 1: RISK_CONFIG is complete and internally consistent
console.log("\n1. RISK_CONFIG structure");
for (const risk of RISKS) {
  const rc = RISK_CONFIG[risk];
  assert(!!rc.fetch, `${risk}: has fetch config`);
  assert(!!rc.filters, `${risk}: has filter config`);
  assert(!!rc.weights, `${risk}: has scoring weights`);
  assert(!!rc.candidates, `${risk}: has candidate config`);

  // Weights must sum to ~1.0
  const wSum = Object.values(rc.weights).reduce((a, b) => a + b, 0);
  assert(
    Math.abs(wSum - 1.0) < 0.01,
    `${risk}: weights sum to 1.0 (got ${wSum.toFixed(3)})`
  );
}

// Test 2: Filtering produces different counts per risk
console.log("\n2. Filtering differentiation");
const filterCounts: Record<RiskTolerance, number> = { high: 0, medium: 0, low: 0 };
for (const risk of RISKS) {
  const filtered = filterContracts(contracts, trade, DEFAULT_FILTERS, risk);
  filterCounts[risk] = filtered.length;
  console.log(`     ${risk}: ${filtered.length} contracts pass filter`);
}
assert(
  filterCounts.high > filterCounts.medium,
  "High risk passes more contracts than medium",
  `high=${filterCounts.high}, medium=${filterCounts.medium}`
);
assert(
  filterCounts.medium >= filterCounts.low,
  "Medium risk passes >= contracts than low",
  `medium=${filterCounts.medium}, low=${filterCounts.low}`
);

// Test 3: Same contract scored differently per risk
console.log("\n3. Scoring differentiation");
// Deep OTM contract: high ROI, bad liquidity, wide spread
const scores: Record<RiskTolerance, number> = { high: 0, medium: 0, low: 0 };
for (const risk of RISKS) {
  scores[risk] = computeCompositeScore(
    500,    // roi: 500%
    0.15,   // delta: far OTM
    -0.02,  // theta
    0.10,   // ask
    0.02,   // bid (wide spread)
    5,      // low OI
    0.60,   // high IV
    risk
  );
  console.log(`     ${risk}: composite score = ${scores[risk].toFixed(4)}`);
}
assert(
  scores.high > scores.medium,
  "High risk scores speculative contract higher than medium",
  `high=${scores.high.toFixed(3)}, medium=${scores.medium.toFixed(3)}`
);

// Conservative contract: low ROI, good liquidity, tight spread
const consScores: Record<RiskTolerance, number> = { high: 0, medium: 0, low: 0 };
for (const risk of RISKS) {
  consScores[risk] = computeCompositeScore(
    30,     // roi: 30%
    0.55,   // delta: near-ATM
    -0.08,  // theta
    5.00,   // ask
    4.80,   // bid (tight spread)
    5000,   // high OI
    0.25,   // low IV
    risk
  );
  console.log(`     ${risk}: conservative score = ${consScores[risk].toFixed(4)}`);
}
assert(
  consScores.low > consScores.high,
  "Low risk scores conservative contract higher than high risk",
  `low=${consScores.low.toFixed(3)}, high=${consScores.high.toFixed(3)}`
);

// Test 4: Enrichment + ranking differs per risk
console.log("\n4. Enrichment ranking differentiation");
const topStrikes: Record<RiskTolerance, number[]> = { high: [], medium: [], low: [] };
for (const risk of RISKS) {
  const filtered = filterContracts(contracts, trade, DEFAULT_FILTERS, risk);
  const enriched = enrichContracts(filtered, trade, risk);
  topStrikes[risk] = enriched.slice(0, 3).map((c) => c.strike);
  console.log(`     ${risk}: top 3 strikes = [${topStrikes[risk].join(", ")}]`);
}
assert(
  JSON.stringify(topStrikes.high) !== JSON.stringify(topStrikes.low),
  "High and low risk produce different top-3 rankings",
  `high=[${topStrikes.high}], low=[${topStrikes.low}]`
);

// Test 5: Fetch config widens with risk
console.log("\n5. Fetch window differentiation");
assert(
  RISK_CONFIG.high.fetch.expiryOffsetDays < RISK_CONFIG.medium.fetch.expiryOffsetDays,
  "High risk has smaller expiry offset (wider window)",
  `high=${RISK_CONFIG.high.fetch.expiryOffsetDays}d, medium=${RISK_CONFIG.medium.fetch.expiryOffsetDays}d`
);
assert(
  RISK_CONFIG.high.fetch.strikePadLow < RISK_CONFIG.medium.fetch.strikePadLow,
  "High risk has wider strike range (lower floor)",
  `high=${RISK_CONFIG.high.fetch.strikePadLow}, medium=${RISK_CONFIG.medium.fetch.strikePadLow}`
);
assert(
  RISK_CONFIG.high.fetch.candidateCount > RISK_CONFIG.medium.fetch.candidateCount,
  "High risk fetches more candidates",
  `high=${RISK_CONFIG.high.fetch.candidateCount}, medium=${RISK_CONFIG.medium.fetch.candidateCount}`
);

// Test 6: Candidate distribution favors OTM for high risk
console.log("\n6. Candidate distribution differentiation");
assert(
  RISK_CONFIG.high.candidates.nearATMPct < RISK_CONFIG.low.candidates.nearATMPct,
  "High risk allocates less to near-ATM than low risk",
  `high=${RISK_CONFIG.high.candidates.nearATMPct}, low=${RISK_CONFIG.low.candidates.nearATMPct}`
);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("FAIL — risk tolerance is not producing differentiated results");
  process.exit(1);
} else {
  console.log("PASS — all risk levels produce distinct behavior");
  process.exit(0);
}
