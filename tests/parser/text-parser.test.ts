/**
 * Text Parser Test Suite
 *
 * Loads JSON fixtures and runs them through parseText() to validate:
 * - Ticker extraction ($TICKER, company names, standalone uppercase)
 * - Direction inference (bearish/bullish signals)
 * - Price extraction (ranges, singles, percentages, confirmation, stop loss)
 * - Date extraction (absolute and relative)
 * - Confidence scoring
 *
 * Run: npx tsx tests/parser/text-parser.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Import parseText directly — it's a pure function with no DB dependencies
import { parseText } from "../../apps/web/lib/parser/text-parser";

interface FixtureExpected {
  trades?: never[];
  ticker?: string;
  direction?: "long" | "short";
  priceTargetLow?: number;
  priceTargetHigh?: number;
  priceTargetPercent?: number;
  priceConfirmation?: number;
  projectedDate?: string;
  stopLoss?: number;
  confidence_max?: number;
}

interface Fixture {
  id: string;
  input: string;
  expected: FixtureExpected | FixtureExpected[];
}

const fixturesPath = join(__dirname, "fixtures", "text-fixtures.json");
const fixtures: Fixture[] = JSON.parse(readFileSync(fixturesPath, "utf8"));

describe("Text Parser — Fixture Tests", () => {
  for (const fixture of fixtures) {
    it(`[${fixture.id}] should parse correctly`, () => {
      const result = parseText(fixture.input);

      // Handle "no trade" fixtures
      if (!Array.isArray(fixture.expected) && fixture.expected.trades !== undefined) {
        assert.strictEqual(
          result.length,
          0,
          `Expected no trades but got ${result.length} for "${fixture.id}"`
        );
        return;
      }

      // Handle multi-ticker fixtures (expected is an array)
      if (Array.isArray(fixture.expected)) {
        assert.ok(
          result.length >= fixture.expected.length,
          `Expected at least ${fixture.expected.length} trades, got ${result.length} for "${fixture.id}"`
        );

        for (const exp of fixture.expected) {
          const match = result.find((r) => r.ticker === exp.ticker);
          assert.ok(
            match,
            `Expected ticker ${exp.ticker} in results for "${fixture.id}". Got: ${result.map((r) => r.ticker).join(", ")}`
          );
          if (exp.priceTargetHigh !== undefined) {
            assert.strictEqual(
              match.priceTargetHigh,
              exp.priceTargetHigh,
              `Wrong priceTargetHigh for ${exp.ticker} in "${fixture.id}"`
            );
          }
        }
        return;
      }

      // Single-ticker fixtures
      const exp = fixture.expected;
      assert.ok(
        result.length >= 1,
        `Expected at least 1 trade, got ${result.length} for "${fixture.id}"`
      );

      const trade = result[0];

      // Ticker
      if (exp.ticker) {
        assert.strictEqual(
          trade.ticker,
          exp.ticker,
          `Wrong ticker for "${fixture.id}". Expected ${exp.ticker}, got ${trade.ticker}`
        );
      }

      // Direction
      if (exp.direction) {
        assert.strictEqual(
          trade.direction,
          exp.direction,
          `Wrong direction for "${fixture.id}". Expected ${exp.direction}, got ${trade.direction}`
        );
      }

      // Price target high
      if (exp.priceTargetHigh !== undefined) {
        assert.strictEqual(
          trade.priceTargetHigh,
          exp.priceTargetHigh,
          `Wrong priceTargetHigh for "${fixture.id}". Expected ${exp.priceTargetHigh}, got ${trade.priceTargetHigh}`
        );
      }

      // Price target low
      if (exp.priceTargetLow !== undefined) {
        assert.strictEqual(
          trade.priceTargetLow,
          exp.priceTargetLow,
          `Wrong priceTargetLow for "${fixture.id}". Expected ${exp.priceTargetLow}, got ${trade.priceTargetLow}`
        );
      }

      // Price target percent
      if (exp.priceTargetPercent !== undefined) {
        assert.ok(
          trade.priceTargetPercent !== null,
          `Expected priceTargetPercent for "${fixture.id}" but got null`
        );
        assert.ok(
          Math.abs((trade.priceTargetPercent ?? 0) - exp.priceTargetPercent) < 1,
          `Wrong priceTargetPercent for "${fixture.id}". Expected ~${exp.priceTargetPercent}, got ${trade.priceTargetPercent}`
        );
      }

      // Price confirmation
      if (exp.priceConfirmation !== undefined) {
        assert.strictEqual(
          trade.priceConfirmation,
          exp.priceConfirmation,
          `Wrong priceConfirmation for "${fixture.id}". Expected ${exp.priceConfirmation}, got ${trade.priceConfirmation}`
        );
      }

      // Stop loss
      if (exp.stopLoss !== undefined) {
        assert.strictEqual(
          trade.stopLoss,
          exp.stopLoss,
          `Wrong stopLoss for "${fixture.id}". Expected ${exp.stopLoss}, got ${trade.stopLoss}`
        );
      }

      // Projected date
      if (exp.projectedDate !== undefined) {
        assert.ok(
          trade.projectedDate !== null,
          `Expected projectedDate for "${fixture.id}" but got null`
        );
        // For absolute dates, check exact match
        // For relative dates, check contains (since format may vary)
        if (exp.projectedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          assert.strictEqual(
            trade.projectedDate,
            exp.projectedDate,
            `Wrong projectedDate for "${fixture.id}". Expected ${exp.projectedDate}, got ${trade.projectedDate}`
          );
        } else {
          assert.ok(
            trade.projectedDate!.toLowerCase().includes(exp.projectedDate.toLowerCase().replace("by ", "")),
            `projectedDate "${trade.projectedDate}" doesn't match expected "${exp.projectedDate}" for "${fixture.id}"`
          );
        }
      }

      // Confidence max (for sparse fixtures)
      if (exp.confidence_max !== undefined) {
        assert.ok(
          trade.confidence <= exp.confidence_max,
          `Confidence ${trade.confidence} exceeds max ${exp.confidence_max} for "${fixture.id}"`
        );
      }

      // Confidence should always be > 0 for non-empty results
      assert.ok(
        trade.confidence > 0,
        `Confidence should be > 0 for "${fixture.id}", got ${trade.confidence}`
      );

      // sourceType should always be "text"
      assert.strictEqual(
        trade.sourceType,
        "text",
        `sourceType should be "text" for "${fixture.id}"`
      );
    });
  }
});

// Summary stats
describe("Text Parser — Coverage Check", () => {
  it(`should have at least 30 test fixtures`, () => {
    assert.ok(
      fixtures.length >= 30,
      `Expected at least 30 fixtures, got ${fixtures.length}`
    );
  });

  it("should include no-trade cases", () => {
    const noTrades = fixtures.filter(
      (f) => !Array.isArray(f.expected) && f.expected.trades !== undefined
    );
    assert.ok(noTrades.length >= 2, `Expected at least 2 no-trade fixtures`);
  });

  it("should include multi-ticker cases", () => {
    const multi = fixtures.filter((f) => Array.isArray(f.expected));
    assert.ok(multi.length >= 1, `Expected at least 1 multi-ticker fixture`);
  });

  it("should include short/bearish cases", () => {
    const shorts = fixtures.filter(
      (f) => !Array.isArray(f.expected) && f.expected.direction === "short"
    );
    assert.ok(shorts.length >= 4, `Expected at least 4 short fixtures`);
  });
});
