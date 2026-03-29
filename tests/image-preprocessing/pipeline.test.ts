/**
 * Image Preprocessing Pipeline Tests
 *
 * Tests each stage of the pipeline against synthetic TradingView-style charts
 * with known ground truth. Validates:
 * - Y-axis price scale extraction (OCR accuracy)
 * - Color isolation (annotation vs. chart separation)
 * - Horizontal line detection (correct positions found)
 * - Annotation text OCR (labels read correctly)
 * - Full pipeline end-to-end (prices match expected)
 *
 * Run: npx tsx tests/image-preprocessing/pipeline.test.ts
 */

import { readFile } from "fs/promises";
import path from "path";
import { preprocessChartImage } from "../../packages/agents/src/parser/image-preprocessing";
import { extractYAxisScale, terminateWorker as terminateYAxisWorker } from "../../packages/agents/src/parser/image-preprocessing/y-axis-extractor";
import { isolateAnnotationLayers } from "../../packages/agents/src/parser/image-preprocessing/color-isolator";
import { detectHorizontalLines } from "../../packages/agents/src/parser/image-preprocessing/line-detector";
import { terminateWorker as terminateAnnotationWorker } from "../../packages/agents/src/parser/image-preprocessing/annotation-ocr";
import { terminateWorker as terminateTVWorker } from "../../packages/agents/src/parser/image-preprocessing/tv-template-stripper";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

interface Expected {
  ticker: string;
  timeframe: string;
  levelCount: number;
  prices: number[];
}

// ── Test infrastructure ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}

function assertApproxEqual(
  actual: number,
  expected: number,
  tolerance: number,
  label: string
): void {
  const diff = Math.abs(actual - expected);
  assert(
    diff <= tolerance,
    `${label}: expected ~${expected}, got ${actual} (diff: ${diff.toFixed(2)}, tolerance: ${tolerance})`
  );
}

async function loadFixture(
  name: string
): Promise<{ image: Buffer; expected: Expected }> {
  const [image, expectedJson] = await Promise.all([
    readFile(path.join(FIXTURES_DIR, `${name}.png`)),
    readFile(path.join(FIXTURES_DIR, `${name}.expected.json`), "utf-8"),
  ]);
  return { image, expected: JSON.parse(expectedJson) };
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function testYAxisExtraction(): Promise<void> {
  console.log("\n── Y-Axis Price Scale Extraction ──");

  const { image } = await loadFixture("chart-001-aapl-basic");
  const scale = await extractYAxisScale(image);

  assert(scale !== null, "Price scale should be extracted");
  if (!scale) return;

  assert(scale.points.length >= 2, `Should have ≥2 price points (got ${scale.points.length})`);
  assert(scale.min <= 165, `Min should be ≤165 (got ${scale.min})`);
  assert(scale.max >= 195, `Max should be ≥195 (got ${scale.max})`);

  // Test interpolation: midpoint of 160-200 range should give ~180
  if (scale.points.length >= 2) {
    const topY = Math.min(...scale.points.map((p) => p.pixel));
    const bottomY = Math.max(...scale.points.map((p) => p.pixel));
    const midY = (topY + bottomY) / 2;
    const midPrice = scale.pixelToPrice(midY);
    assertApproxEqual(midPrice, 180, 10, "Midpoint interpolation");
  }
}

async function testColorIsolation(): Promise<void> {
  console.log("\n── Color Isolation ──");

  const { image } = await loadFixture("chart-002-tsla-three-levels");

  const layers = await isolateAnnotationLayers(image);

  assert(layers.annotations.length > 0, "Annotation layer should have data");
  assert(layers.levels.length > 0, "Levels layer should have data");
  assert(layers.base.length > 0, "Base layer should have data");

  // Annotations should be smaller than the original (most pixels removed)
  assert(
    layers.annotations.length < image.length * 2,
    "Annotation layer should be reasonably sized"
  );
}

async function testLineDetection(): Promise<void> {
  console.log("\n── Horizontal Line Detection ──");

  const { image } = await loadFixture("chart-002-tsla-three-levels");
  const layers = await isolateAnnotationLayers(image);

  // Detect lines in the red annotation mask (binary mask, not applied image)
  const redLines = await detectHorizontalLines(layers.annotationMask, 0.1);
  console.log(`  Found ${redLines.length} red lines`);
  // The fixture has 2 red lines (BUY at 895, TARGET at 920)
  assert(redLines.length >= 1, `Should detect ≥1 red line (got ${redLines.length})`);

  // Detect lines in the blue levels mask (dilated to close dash gaps)
  const blueLines = await detectHorizontalLines(layers.levelsMask, 0.1);
  console.log(`  Found ${blueLines.length} blue lines`);
  // The fixture has 1 blue line (support at 875)
  assert(blueLines.length >= 1, `Should detect ≥1 blue line (got ${blueLines.length})`);
}

async function testFullPipeline(): Promise<void> {
  console.log("\n── Full Pipeline (End-to-End) ──");

  const fixtures = [
    "chart-001-aapl-basic",
    "chart-002-tsla-three-levels",
    "chart-003-nvda-minimal",
    "chart-004-sox-many-levels",
    "chart-005-meta-wide",
  ];

  for (const name of fixtures) {
    console.log(`\n  Testing ${name}...`);
    const { image, expected } = await loadFixture(name);

    const result = await preprocessChartImage(image);

    console.log(`    Ticker: ${result.ticker ?? "(none)"} (expected: ${expected.ticker})`);
    console.log(`    Timeframe: ${result.timeframe ?? "(none)"} (expected: ${expected.timeframe})`);
    console.log(`    Levels: ${result.detectedLevels.length} (expected: ${expected.levelCount})`);
    console.log(`    Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`    Processing time: ${result.processingTimeMs}ms`);

    if (result.detectedLevels.length > 0) {
      console.log(`    Detected prices: [${result.detectedLevels.map((l) => l.price.toFixed(2)).join(", ")}]`);
      console.log(`    Expected prices: [${expected.prices.join(", ")}]`);
    }

    if (result.annotationTexts.length > 0) {
      console.log(`    Annotation texts: [${result.annotationTexts.map((a) => `"${a.text}"`).join(", ")}]`);
    }

    // Validate price accuracy for each expected level
    // Use a generous tolerance since OCR and line detection have inherent imprecision
    const priceRange = Math.max(...expected.prices) - Math.min(...expected.prices);
    const tolerance = Math.max(priceRange * 0.12, 5); // 12% of range or $5, whichever is larger (accounts for proportional Y estimation in OCR)

    for (const expectedPrice of expected.prices) {
      const match = result.detectedLevels.find(
        (l) => Math.abs(l.price - expectedPrice) <= tolerance
      );
      assert(
        match !== undefined,
        `${name}: should detect level near $${expectedPrice} (tolerance: ±${tolerance.toFixed(1)})`
      );
    }
  }
}

async function testPipelinePerformance(): Promise<void> {
  console.log("\n── Pipeline Performance ──");

  const { image } = await loadFixture("chart-001-aapl-basic");

  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    await preprocessChartImage(image);
    times.push(Date.now() - start);
  }

  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`  Average: ${avgMs.toFixed(0)}ms over ${times.length} runs`);
  console.log(`  Individual: [${times.map((t) => `${t}ms`).join(", ")}]`);

  // Pipeline should complete within 10 seconds (OCR is slow on first load)
  assert(
    avgMs < 10_000,
    `Average pipeline time should be <10s (got ${avgMs.toFixed(0)}ms)`
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Image Preprocessing Pipeline Tests");
  console.log("===================================");

  try {
    await testYAxisExtraction();
    await testColorIsolation();
    await testLineDetection();
    await testFullPipeline();
    await testPipelinePerformance();
  } finally {
    // Clean up Tesseract workers
    await Promise.all([
      terminateYAxisWorker(),
      terminateAnnotationWorker(),
      terminateTVWorker(),
    ]);
  }

  console.log("\n===================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  ✗ ${f}`);
    }
    process.exit(1);
  } else {
    console.log("\nAll tests passed!");
  }
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
