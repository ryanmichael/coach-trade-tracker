/**
 * Vision Post-Processing Test Suite
 *
 * Tests the direction correction, level reclassification, and support-breakdown
 * detection logic extracted from the image analysis route.
 *
 * Run: npx tsx tests/parser/vision-post-process.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert";

import {
  detectSupportBreakdown,
  inferDirectionFromLevels,
  reclassifyLevels,
  postProcessVision,
  type PriceLevel,
} from "../../apps/web/lib/parser/post-process-vision";

// ── Support Breakdown Detection ──────────────────────────────────────────────

describe("detectSupportBreakdown", () => {
  it("detects breakdown when CRITICAL SUPPORT annotation + price below", () => {
    const levels: PriceLevel[] = [
      { value: 7317, type: "entry", label: "current price" },
      { value: 7400, type: "support", label: "critical support" },
    ];
    const result = detectSupportBreakdown(
      ["CRITICAL SUPPORT", "7400"],
      levels,
      7317
    );
    assert.strictEqual(result.isBreakdown, true);
    assert.strictEqual(result.brokenLevels.length, 1);
    assert.strictEqual(result.brokenLevels[0].value, 7400);
  });

  it("detects breakdown when KEY SUPPORT annotation + price below", () => {
    const levels: PriceLevel[] = [
      { value: 150, type: "entry", label: null },
      { value: 160, type: "support", label: "key support" },
    ];
    const result = detectSupportBreakdown(
      ["KEY SUPPORT at 160"],
      levels,
      150
    );
    assert.strictEqual(result.isBreakdown, true);
  });

  it("detects breakdown with split annotations (critical + support separate)", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 110, type: "unknown", label: null },
    ];
    const result = detectSupportBreakdown(
      ["CRITICAL", "SUPPORT ZONE"],
      levels,
      100
    );
    assert.strictEqual(result.isBreakdown, true);
  });

  it("does NOT detect breakdown when annotation missing", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 110, type: "support", label: null },
    ];
    const result = detectSupportBreakdown(["some other annotation"], levels, 100);
    assert.strictEqual(result.isBreakdown, false);
  });

  it("does NOT detect breakdown when support is BELOW entry (legitimate support)", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 90, type: "support", label: "critical support" },
    ];
    const result = detectSupportBreakdown(
      ["CRITICAL SUPPORT 90"],
      levels,
      100
    );
    assert.strictEqual(result.isBreakdown, false);
  });

  it("does NOT detect breakdown without entry level and no labeled critical support", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "support", label: null },
    ];
    const result = detectSupportBreakdown(["CRITICAL SUPPORT"], levels, undefined);
    assert.strictEqual(result.isBreakdown, false);
  });

  it("infers entry from labeled critical support when no explicit entry", () => {
    const levels: PriceLevel[] = [
      { value: 200, type: "support", label: "Critical support - lower channel boundary" },
      { value: 225, type: "resistance", label: "Upper resistance" },
    ];
    const result = detectSupportBreakdown(
      ["Critical support — label with arrow pointing to $200"],
      levels,
      undefined
    );
    assert.strictEqual(result.isBreakdown, true);
    assert.strictEqual(result.inferredEntry, 200);
    assert.strictEqual(result.brokenLevels.length, 1);
    assert.strictEqual(result.brokenLevels[0].value, 225);
  });

  it("requires 0.5% threshold above entry", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 100.3, type: "support", label: null },
    ];
    const result = detectSupportBreakdown(["CRITICAL SUPPORT"], levels, 100);
    assert.strictEqual(result.isBreakdown, false, "0.3% above should not trigger");
  });
});

// ── Direction Inference from Levels ──────────────────────────────────────────

describe("inferDirectionFromLevels", () => {
  it("infers bullish when all targets above entry", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 120, type: "target", label: null },
      { value: 130, type: "target", label: null },
    ];
    const dir = inferDirectionFromLevels(levels, 100, null);
    assert.strictEqual(dir, "bullish");
  });

  it("infers bearish when all targets below entry", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 80, type: "target", label: null },
      { value: 70, type: "target", label: null },
    ];
    const dir = inferDirectionFromLevels(levels, 100, null);
    assert.strictEqual(dir, "bearish");
  });

  it("keeps original direction when levels are mixed", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 110, type: "target", label: null },
      { value: 90, type: "target", label: null },
    ];
    const dir = inferDirectionFromLevels(levels, 100, "bullish");
    assert.strictEqual(dir, "bullish");
  });

  it("ignores levels within 2% of entry", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 101, type: "target", label: null }, // 1% — insignificant
      { value: 80, type: "target", label: null },  // significant
    ];
    const dir = inferDirectionFromLevels(levels, 100, null);
    assert.strictEqual(dir, "bearish");
  });

  it("preserves neutral direction", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 120, type: "target", label: null },
    ];
    const dir = inferDirectionFromLevels(levels, 100, "neutral");
    assert.strictEqual(dir, "neutral");
  });

  it("returns current direction when no entry level", () => {
    const levels: PriceLevel[] = [
      { value: 120, type: "target", label: null },
    ];
    const dir = inferDirectionFromLevels(levels, undefined, "bearish");
    assert.strictEqual(dir, "bearish");
  });

  it("excludes support-typed levels from bullish inference", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 120, type: "support", label: "broken support" },
    ];
    // Support above entry shouldn't trigger bullish (could be broken support)
    const dir = inferDirectionFromLevels(levels, 100, null);
    // Should fall through to all levels if no directional levels found
    assert.ok(dir === "bullish" || dir === null);
  });
});

// ── Level Reclassification ──────────────────────────────────────────────────

describe("reclassifyLevels", () => {
  it("reclassifies resistance above entry → target in bullish setup", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 120, type: "resistance", label: "R1" },
    ];
    const result = reclassifyLevels(levels, 100, "bullish");
    assert.strictEqual(result[1].type, "target");
  });

  it("reclassifies support below entry → target in bearish setup", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 80, type: "support", label: "S1" },
    ];
    const result = reclassifyLevels(levels, 100, "bearish");
    assert.strictEqual(result[1].type, "target");
  });

  it("does NOT reclassify resistance below entry in bullish setup", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 90, type: "resistance", label: "R1" },
    ];
    const result = reclassifyLevels(levels, 100, "bullish");
    assert.strictEqual(result[1].type, "resistance");
  });

  it("preserves all levels in neutral setup", () => {
    const levels: PriceLevel[] = [
      { value: 100, type: "entry", label: null },
      { value: 120, type: "resistance", label: null },
      { value: 80, type: "support", label: null },
    ];
    const result = reclassifyLevels(levels, 100, "neutral");
    assert.strictEqual(result[1].type, "resistance");
    assert.strictEqual(result[2].type, "support");
  });

  it("preserves levels when no entry level", () => {
    const levels: PriceLevel[] = [
      { value: 120, type: "resistance", label: null },
    ];
    const result = reclassifyLevels(levels, undefined, "bullish");
    assert.strictEqual(result[0].type, "resistance");
  });
});

// ── Full Pipeline ────────────────────────────────────────────────────────────

describe("postProcessVision — full pipeline", () => {
  it("support breakdown → bearish + relabeled levels", () => {
    const result = postProcessVision({
      direction: "bullish",
      priceLevels: [
        { value: 7317, type: "entry", label: "current" },
        { value: 7400, type: "support", label: "critical support" },
      ],
      annotations: ["CRITICAL SUPPORT", "7400"],
    });

    assert.strictEqual(result.correctedDirection, "bearish");
    assert.strictEqual(result.supportBreakdownOverride, true);
    const brokenLevel = result.reclassifiedLevels.find((l) => l.value === 7400);
    assert.strictEqual(brokenLevel?.type, "resistance");
  });

  it("bullish correction from level positions", () => {
    const result = postProcessVision({
      direction: null,
      priceLevels: [
        { value: 100, type: "entry", label: null },
        { value: 120, type: "resistance", label: "R1" },
        { value: 130, type: "resistance", label: "R2" },
      ],
      annotations: [],
    });

    assert.strictEqual(result.correctedDirection, "bullish");
    assert.strictEqual(result.supportBreakdownOverride, false);
    // Resistance should be reclassified to target in bullish
    assert.ok(result.reclassifiedLevels.filter((l) => l.type === "target").length >= 2);
  });

  it("bearish correction from level positions", () => {
    const result = postProcessVision({
      direction: null,
      priceLevels: [
        { value: 100, type: "entry", label: null },
        { value: 80, type: "support", label: "S1" },
        { value: 70, type: "target", label: "target" },
      ],
      annotations: [],
    });

    assert.strictEqual(result.correctedDirection, "bearish");
    // Support below entry gets reclassified to target in bearish
    assert.ok(result.reclassifiedLevels.filter((l) => l.type === "target").length >= 2);
  });

  it("neutral direction preserved through pipeline", () => {
    const result = postProcessVision({
      direction: "neutral",
      priceLevels: [
        { value: 100, type: "entry", label: null },
        { value: 110, type: "resistance", label: null },
        { value: 90, type: "support", label: null },
      ],
      annotations: [],
    });

    assert.strictEqual(result.correctedDirection, "neutral");
    assert.strictEqual(
      result.reclassifiedLevels.find((l) => l.value === 110)?.type,
      "resistance"
    );
    assert.strictEqual(
      result.reclassifiedLevels.find((l) => l.value === 90)?.type,
      "support"
    );
  });

  it("empty levels — no crash, preserves direction", () => {
    const result = postProcessVision({
      direction: "bearish",
      priceLevels: [],
      annotations: [],
    });
    assert.strictEqual(result.correctedDirection, "bearish");
    assert.strictEqual(result.reclassifiedLevels.length, 0);
  });
});
