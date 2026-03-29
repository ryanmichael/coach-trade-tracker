#!/usr/bin/env npx tsx
/**
 * Image Analysis Quality Test Harness
 *
 * Tests the full Vision analysis pipeline against chart image fixtures with
 * known ground truth. Two run modes:
 *
 *   --live     Calls Claude Vision API, saves raw response as snapshot for replay.
 *              Slow (~3s/image), costs API credits.
 *
 *   --replay   Uses cached API snapshots. Tests post-processing, geometry builder,
 *              level classification — everything downstream of the API call.
 *              Fast (<1s total), free. Default mode.
 *
 * Usage:
 *   npx tsx tests/image-analysis/run.ts                # replay mode (default)
 *   npx tsx tests/image-analysis/run.ts --live          # live API calls
 *   npx tsx tests/image-analysis/run.ts --live --save   # live + overwrite snapshots
 *   npx tsx tests/image-analysis/run.ts --verbose       # show per-field details
 *   npx tsx tests/image-analysis/run.ts --filter step   # only run fixtures matching "step"
 *
 * Fixture format (image-fixtures.json):
 *   {
 *     "id": "unique_id",
 *     "image": "images/filename.png",
 *     "expected": {
 *       "ticker": "MAGS",
 *       "direction": "bearish",
 *       "pattern": "step_down",              // optional — tests geometry pattern detection
 *       "priceLevels": [                     // optional — tests extracted price levels
 *         { "value": 63, "type": "resistance", "tolerance": 2 }
 *       ],
 *       "directionRequired": true,           // fail if direction doesn't match
 *       "notes": "description for humans"
 *     }
 *   }
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { postProcessVision } from "../../apps/web/lib/parser/post-process-vision";
import { extractChartGeometry } from "../../packages/agents/src/chart-visualization/shape-extractor";
import { buildChartData } from "../../packages/agents/src/chart-visualization/geometry-builder";
import type { ChartGeometry } from "../../packages/agents/src/chart-visualization/types";

// Load .env.local if present (for ANTHROPIC_API_KEY)
const envPath = path.join(__dirname, "../../.env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ExpectedPriceLevel {
  value: number;
  type: "target" | "support" | "resistance" | "entry";
  tolerance?: number; // default 2% of value
  label?: string;     // if set, also check label contains this string
}

interface ExpectedChannel {
  upperStart?: number;  // upper boundary at left edge of chart
  upperEnd?: number;    // upper boundary at right edge
  lowerStart?: number;  // lower boundary at left edge
  lowerEnd?: number;    // lower boundary at right edge
  tolerance?: number;   // default 8
}

interface ExpectedStepDownZone {
  upper: number;        // top of consolidation box
  lower: number;        // bottom of consolidation box
  tolerance?: number;   // default 5
}

interface ExpectedStepDown {
  diagonal?: {
    start: number;      // resistance ceiling at left edge (highest point)
    end: number;        // resistance ceiling at right edge
    tolerance?: number; // default 8
  };
  zones?: ExpectedStepDownZone[];  // ordered highest to lowest
}

interface ExpectedTriangle {
  subtype?: "symmetrical" | "ascending" | "descending";
  upperTrendline?: {
    startPrice: number;
    endPrice: number;
    tolerance?: number;
  };
  lowerTrendline?: {
    startPrice: number;
    endPrice: number;
    tolerance?: number;
  };
  swingPoints?: Array<{
    price: number;
    type: "high" | "low";
    tolerance?: number;
  }>;
  apex?: {
    price: number;
    tolerance?: number;
  };
}

interface FixtureExpected {
  ticker?: string;
  direction?: "bullish" | "bearish" | "neutral";
  pattern?: string;
  priceLevels?: ExpectedPriceLevel[];
  channel?: ExpectedChannel;
  stepDown?: ExpectedStepDown;
  triangle?: ExpectedTriangle;
  directionRequired?: boolean;
  minConfidence?: number;
  notes?: string;
}

interface Fixture {
  id: string;
  image: string;
  expected: FixtureExpected;
}

interface NLPSnapshot {
  raw: Record<string, unknown>;
  timestamp: string;
  model: string;
  processingTimeMs: number;
}

interface GeometrySnapshot {
  geometry: ChartGeometry | null;
  timestamp: string;
}

interface Snapshot {
  nlp: NLPSnapshot;
  geometry: GeometrySnapshot;
}

interface FieldScore {
  field: string;
  pass: boolean;
  expected: string;
  actual: string;
  detail?: string;
}

interface FixtureResult {
  id: string;
  scores: FieldScore[];
  passed: number;
  failed: number;
  accuracy: number;
  processingTimeMs: number;
}

// ── Configuration ────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const SNAPSHOTS_DIR = path.join(FIXTURES_DIR, "snapshots");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
const VISION_MODEL = "claude-sonnet-4-6";

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isLive = args.includes("--live");
const saveSnapshots = args.includes("--save") || isLive;
const verbose = args.includes("--verbose");
const filterArg = args.find((a, i) => args[i - 1] === "--filter") ?? "";

// ── Vision API call (live mode only) ─────────────────────────────────────────

let _cachedPrompt: string | null = null;
const useCoachContext = args.includes("--coach");
const DEV_SERVER = process.env.DEV_SERVER_URL ?? "http://localhost:3000";

async function loadVisionPrompt(): Promise<string> {
  if (_cachedPrompt) return _cachedPrompt;

  // With --coach flag, fetch Coach-powered prompt from dev server API
  if (useCoachContext) {
    try {
      const res = await fetch(`${DEV_SERVER}/api/coach/vision-prompt`);
      if (res.ok) {
        const data = await res.json() as { prompt?: string };
        if (data.prompt && data.prompt.length > 500) {
          console.log(`    Using Coach-powered Vision prompt (${data.prompt.length} chars)`);
          _cachedPrompt = data.prompt;
          return _cachedPrompt;
        }
      }
    } catch {
      console.log(`    Dev server not reachable at ${DEV_SERVER} — falling back to generic prompt`);
    }
  }

  // Default: generic prompt (no Coach context / no DB dependency)
  const { getGenericVisionPrompt } = await import(
    "../../packages/agents/src/coach-intelligence/generic-vision-prompt"
  );
  if (useCoachContext) {
    console.log(`    Could not load Coach prompt — using generic`);
  }
  _cachedPrompt = getGenericVisionPrompt();
  return _cachedPrompt;
}

async function callVisionAPI(
  imageBase64: string,
  mediaType: string
): Promise<{ raw: Record<string, unknown>; processingTimeMs: number }> {
  const visionPrompt = await loadVisionPrompt();

  const start = Date.now();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 4096,
      system: visionPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            {
              type: "text",
              text: "Analyze this chart image thoroughly. Read every price label on the y-axis, every drawn horizontal line, every annotation, and every piece of text visible on the chart. Return the complete JSON.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json() as { content?: Array<{ text?: string }> };
  const rawText = data.content?.[0]?.text ?? "{}";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Vision response");

  const parsed = JSON.parse(jsonMatch[0]);
  return { raw: parsed, processingTimeMs: Date.now() - start };
}

async function callGeometryExtraction(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"
): Promise<ChartGeometry | null> {
  const coachContext = await loadVisionPrompt();
  return extractChartGeometry(imageBase64, mediaType, coachContext);
}

// ── Snapshot management ──────────────────────────────────────────────────────

function snapshotPath(fixtureId: string): string {
  return path.join(SNAPSHOTS_DIR, `${fixtureId}.snapshot.json`);
}

async function loadSnapshot(fixtureId: string): Promise<Snapshot | null> {
  const p = snapshotPath(fixtureId);
  if (!existsSync(p)) return null;
  const raw = await readFile(p, "utf-8");
  return JSON.parse(raw) as Snapshot;
}

async function saveSnapshot(fixtureId: string, snapshot: Snapshot): Promise<void> {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  await writeFile(snapshotPath(fixtureId), JSON.stringify(snapshot, null, 2));
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function scoreFixture(
  fixture: Fixture,
  nlpRaw: Record<string, unknown>,
  geometry: ChartGeometry | null
): FieldScore[] {
  const scores: FieldScore[] = [];
  const expected = fixture.expected;

  // Post-process the NLP output (same as the image route does)
  type PriceLevelType = "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown";
  const rawLevels = (nlpRaw.price_levels as Array<{ value: number; type: string; label: string | null }>) ?? [];
  const priceLevels = rawLevels.map((l) => ({
    value: l.value,
    type: (l.type as PriceLevelType) ?? "unknown",
    label: l.label,
  }));
  const annotations = (nlpRaw.annotations as string[]) ?? [];
  const postProcessed = postProcessVision({
    direction: (nlpRaw.direction as "bullish" | "bearish" | "neutral" | null) ?? null,
    priceLevels,
    annotations,
  });

  let actualDirection = postProcessed.correctedDirection;
  const actualLevels = postProcessed.reclassifiedLevels;
  const actualTicker = nlpRaw.ticker as string | null;
  const actualConfidence = (nlpRaw.confidence as number) ?? 0;

  // Mirror route-level override: step_down pattern from geometry → force bearish
  if (geometry?.pattern === "step_down" && actualDirection !== "bearish") {
    actualDirection = "bearish";
  }

  // ── Ticker ──
  if (expected.ticker) {
    const tickerMatch = actualTicker?.toUpperCase() === expected.ticker.toUpperCase();
    scores.push({
      field: "ticker",
      pass: tickerMatch,
      expected: expected.ticker,
      actual: actualTicker ?? "(none)",
    });
  }

  // ── Direction ──
  if (expected.direction) {
    const dirMatch = actualDirection === expected.direction;
    scores.push({
      field: "direction",
      pass: expected.directionRequired ? dirMatch : true,
      expected: expected.direction,
      actual: actualDirection ?? "(none)",
      detail: dirMatch ? undefined : (expected.directionRequired ? "REQUIRED" : "advisory"),
    });
  }

  // ── Pattern (from geometry extraction) ──
  if (expected.pattern && geometry) {
    const patternMatch = geometry.pattern === expected.pattern;
    scores.push({
      field: "pattern",
      pass: patternMatch,
      expected: expected.pattern,
      actual: geometry.pattern ?? "(none)",
    });
  } else if (expected.pattern && !geometry) {
    scores.push({
      field: "pattern",
      pass: false,
      expected: expected.pattern,
      actual: "(no geometry extracted)",
    });
  }

  // ── Price levels ──
  if (expected.priceLevels) {
    for (const expectedLevel of expected.priceLevels) {
      const tolerance = expectedLevel.tolerance ?? expectedLevel.value * 0.02;

      // Find closest matching level by value
      const match = actualLevels.find(
        (l) => Math.abs(l.value - expectedLevel.value) <= tolerance
      );

      if (!match) {
        scores.push({
          field: `level:${expectedLevel.type}@${expectedLevel.value}`,
          pass: false,
          expected: `${expectedLevel.type} at $${expectedLevel.value} (±${tolerance.toFixed(1)})`,
          actual: `not found in [${actualLevels.map((l) => `${l.type}:$${l.value}`).join(", ")}]`,
        });
        continue;
      }

      // Check type matches
      const typeMatch = match.type === expectedLevel.type;
      scores.push({
        field: `level:${expectedLevel.type}@${expectedLevel.value}`,
        pass: typeMatch,
        expected: `${expectedLevel.type} at $${expectedLevel.value}`,
        actual: `${match.type} at $${match.value}`,
        detail: typeMatch ? undefined : `type mismatch: expected ${expectedLevel.type}, got ${match.type}`,
      });

      // Check label if specified
      if (expectedLevel.label) {
        const labelMatch = match.label?.toLowerCase().includes(expectedLevel.label.toLowerCase()) ?? false;
        scores.push({
          field: `label:${expectedLevel.type}@${expectedLevel.value}`,
          pass: labelMatch,
          expected: `label contains "${expectedLevel.label}"`,
          actual: match.label ?? "(no label)",
        });
      }
    }
  }

  // ── Confidence ──
  if (expected.minConfidence !== undefined) {
    scores.push({
      field: "confidence",
      pass: actualConfidence >= expected.minConfidence,
      expected: `≥ ${expected.minConfidence}`,
      actual: actualConfidence.toFixed(2),
    });
  }

  // ── Channel overlay ──
  if (expected.channel && geometry) {
    const hasYAxis = geometry.yAxisMin != null && geometry.yAxisMax != null;
    const cu = geometry.channelUpper;
    const cl = geometry.channelLower;
    const denorm = (v: number) =>
      hasYAxis ? geometry.yAxisMin! + v * (geometry.yAxisMax! - geometry.yAxisMin!) : v;
    const chanTol = expected.channel.tolerance ?? 8;

    if (!cu || !cl || !hasYAxis) {
      scores.push({
        field: "channel:extracted",
        pass: false,
        expected: "channelUpper + channelLower + yAxis",
        actual: `upper=${cu ? "yes" : "no"}, lower=${cl ? "yes" : "no"}, yAxis=${hasYAxis ? "yes" : "no"}`,
      });
    } else {
      // Upper boundary: start (left edge) and end (right edge)
      if (expected.channel.upperStart != null) {
        const actual = denorm(cu[0]);
        scores.push({
          field: "channel:upperStart",
          pass: Math.abs(actual - expected.channel.upperStart) <= chanTol,
          expected: `$${expected.channel.upperStart} (±${chanTol})`,
          actual: `$${actual.toFixed(1)}`,
        });
      }
      if (expected.channel.upperEnd != null) {
        const actual = denorm(cu[cu.length - 1]);
        scores.push({
          field: "channel:upperEnd",
          pass: Math.abs(actual - expected.channel.upperEnd) <= chanTol,
          expected: `$${expected.channel.upperEnd} (±${chanTol})`,
          actual: `$${actual.toFixed(1)}`,
        });
      }
      // Lower boundary: start (left edge) and end (right edge)
      if (expected.channel.lowerStart != null) {
        const actual = denorm(cl[0]);
        scores.push({
          field: "channel:lowerStart",
          pass: Math.abs(actual - expected.channel.lowerStart) <= chanTol,
          expected: `$${expected.channel.lowerStart} (±${chanTol})`,
          actual: `$${actual.toFixed(1)}`,
        });
      }
      if (expected.channel.lowerEnd != null) {
        const actual = denorm(cl[cl.length - 1]);
        scores.push({
          field: "channel:lowerEnd",
          pass: Math.abs(actual - expected.channel.lowerEnd) <= chanTol,
          expected: `$${expected.channel.lowerEnd} (±${chanTol})`,
          actual: `$${actual.toFixed(1)}`,
        });
      }
    }
  }

  // ── Step-down zones + diagonal ──
  if (expected.stepDown && geometry?.stepDownData) {
    const sd = geometry.stepDownData;
    const hasYAxis = geometry.yAxisMin != null && geometry.yAxisMax != null;
    // Detect whether stepDownData is normalized (0–1) or already dollar prices
    const sdIsNormalized = [sd.diagonalStart, sd.diagonalEnd, ...sd.zones.flatMap((z) => [z.upper, z.lower])]
      .every((v) => v >= 0 && v <= 1.0);
    const sdToPrice = (v: number) =>
      sdIsNormalized && hasYAxis ? geometry.yAxisMin! + v * (geometry.yAxisMax! - geometry.yAxisMin!) : v;

    // Diagonal resistance ceiling
    if (expected.stepDown.diagonal && (hasYAxis || !sdIsNormalized)) {
      const diagTol = expected.stepDown.diagonal.tolerance ?? 8;
      const actualStart = sdToPrice(sd.diagonalStart);
      const actualEnd = sdToPrice(sd.diagonalEnd);
      scores.push({
        field: "stepDown:diagonalStart",
        pass: Math.abs(actualStart - expected.stepDown.diagonal.start) <= diagTol,
        expected: `$${expected.stepDown.diagonal.start} (±${diagTol})`,
        actual: `$${actualStart.toFixed(1)}`,
      });
      scores.push({
        field: "stepDown:diagonalEnd",
        pass: Math.abs(actualEnd - expected.stepDown.diagonal.end) <= diagTol,
        expected: `$${expected.stepDown.diagonal.end} (±${diagTol})`,
        actual: `$${actualEnd.toFixed(1)}`,
      });
      scores.push({
        field: "stepDown:diagonalDescending",
        pass: actualStart > actualEnd,
        expected: "start > end (descending)",
        actual: `$${actualStart.toFixed(1)} → $${actualEnd.toFixed(1)}`,
      });
    }

    // Consolidation zones
    if (expected.stepDown.zones && (hasYAxis || !sdIsNormalized)) {
      scores.push({
        field: "stepDown:zoneCount",
        pass: sd.zones.length >= expected.stepDown.zones.length,
        expected: `≥ ${expected.stepDown.zones.length} zones`,
        actual: `${sd.zones.length} zones`,
      });

      for (let i = 0; i < expected.stepDown.zones.length; i++) {
        const ez = expected.stepDown.zones[i];
        const zoneTol = ez.tolerance ?? 5;

        if (i >= sd.zones.length) {
          scores.push({
            field: `stepDown:zone${i + 1}`,
            pass: false,
            expected: `$${ez.lower}–$${ez.upper}`,
            actual: "zone not extracted",
          });
          continue;
        }

        const az = sd.zones[i];
        const actualUpper = sdToPrice(az.upper);
        const actualLower = sdToPrice(az.lower);
        const upperOk = Math.abs(actualUpper - ez.upper) <= zoneTol;
        const lowerOk = Math.abs(actualLower - ez.lower) <= zoneTol;
        scores.push({
          field: `stepDown:zone${i + 1}:upper`,
          pass: upperOk,
          expected: `$${ez.upper} (±${zoneTol})`,
          actual: `$${actualUpper.toFixed(1)}`,
        });
        scores.push({
          field: `stepDown:zone${i + 1}:lower`,
          pass: lowerOk,
          expected: `$${ez.lower} (±${zoneTol})`,
          actual: `$${actualLower.toFixed(1)}`,
        });
      }
    }
  } else if (expected.stepDown && !geometry?.stepDownData) {
    scores.push({
      field: "stepDown:extracted",
      pass: false,
      expected: "stepDownData present",
      actual: geometry ? "stepDownData is null" : "no geometry extracted",
    });
  }

  // ── Triangle ──
  if (expected.triangle && geometry?.triangleData) {
    const td = geometry.triangleData;

    // Subtype
    if (expected.triangle.subtype) {
      scores.push({
        field: "triangle:subtype",
        pass: td.subtype === expected.triangle.subtype,
        expected: expected.triangle.subtype,
        actual: td.subtype,
      });
    }

    // Upper trendline
    if (expected.triangle.upperTrendline) {
      const tol = expected.triangle.upperTrendline.tolerance ?? 50;
      scores.push({
        field: "triangle:upperStart",
        pass: Math.abs(td.upperTrendline.startPrice - expected.triangle.upperTrendline.startPrice) <= tol,
        expected: `$${expected.triangle.upperTrendline.startPrice} (±${tol})`,
        actual: `$${td.upperTrendline.startPrice.toFixed(1)}`,
      });
      scores.push({
        field: "triangle:upperEnd",
        pass: Math.abs(td.upperTrendline.endPrice - expected.triangle.upperTrendline.endPrice) <= tol,
        expected: `$${expected.triangle.upperTrendline.endPrice} (±${tol})`,
        actual: `$${td.upperTrendline.endPrice.toFixed(1)}`,
      });
    }

    // Lower trendline
    if (expected.triangle.lowerTrendline) {
      const tol = expected.triangle.lowerTrendline.tolerance ?? 50;
      scores.push({
        field: "triangle:lowerStart",
        pass: Math.abs(td.lowerTrendline.startPrice - expected.triangle.lowerTrendline.startPrice) <= tol,
        expected: `$${expected.triangle.lowerTrendline.startPrice} (±${tol})`,
        actual: `$${td.lowerTrendline.startPrice.toFixed(1)}`,
      });
      scores.push({
        field: "triangle:lowerEnd",
        pass: Math.abs(td.lowerTrendline.endPrice - expected.triangle.lowerTrendline.endPrice) <= tol,
        expected: `$${expected.triangle.lowerTrendline.endPrice} (±${tol})`,
        actual: `$${td.lowerTrendline.endPrice.toFixed(1)}`,
      });
    }

    // Swing points
    if (expected.triangle.swingPoints) {
      scores.push({
        field: "triangle:swingCount",
        pass: td.swingPoints.length >= expected.triangle.swingPoints.length,
        expected: `≥ ${expected.triangle.swingPoints.length} points`,
        actual: `${td.swingPoints.length} points`,
      });

      for (let i = 0; i < Math.min(expected.triangle.swingPoints.length, td.swingPoints.length); i++) {
        const ep = expected.triangle.swingPoints[i];
        const ap = td.swingPoints[i];
        const tol = ep.tolerance ?? 50;
        scores.push({
          field: `triangle:swing${i + 1}`,
          pass: Math.abs(ap.price - ep.price) <= tol && ap.type === ep.type,
          expected: `${ep.type} at $${ep.price} (±${tol})`,
          actual: `${ap.type} at $${ap.price.toFixed(1)}`,
        });
      }
    }

    // Apex
    if (expected.triangle.apex) {
      const tol = expected.triangle.apex.tolerance ?? 50;
      scores.push({
        field: "triangle:apex",
        pass: Math.abs(td.apexPrice - expected.triangle.apex.price) <= tol,
        expected: `$${expected.triangle.apex.price} (±${tol})`,
        actual: `$${td.apexPrice.toFixed(1)}`,
      });
    }
  } else if (expected.triangle && !geometry?.triangleData) {
    scores.push({
      field: "triangle:extracted",
      pass: false,
      expected: "triangleData present",
      actual: geometry ? "triangleData is null" : "no geometry extracted",
    });
  }

  // ── Geometry → ChartData build (should not crash) ──
  if (geometry && geometry.confidence >= 0.5 && geometry.priceShape.length >= 5) {
    const targetLevels = actualLevels.filter((l) => l.type === "target").map((l) => l.value);
    const trade = {
      priceTargetLow: targetLevels.length ? Math.min(...targetLevels) : null,
      priceTargetHigh: targetLevels.length ? Math.max(...targetLevels) : null,
      priceConfirmation: actualLevels.find((l) => l.type === "entry")?.value ?? null,
      stopLoss: actualLevels.find((l) => l.type === "stop_loss")?.value ?? null,
      supportLevel: actualLevels.find((l) => l.type === "support")?.value ?? null,
      resistanceLevel: actualLevels.find((l) => l.type === "resistance")?.value ?? null,
    };
    const proxyPrice =
      trade.priceConfirmation ??
      trade.priceTargetHigh ?? trade.priceTargetLow ??
      trade.supportLevel ?? trade.resistanceLevel ?? 100;
    try {
      const chartData = buildChartData(geometry, trade, proxyPrice);
      scores.push({
        field: "chartData:build",
        pass: chartData.prices.length >= 5,
        expected: "≥ 5 prices",
        actual: `${chartData.prices.length} prices, pattern=${chartData.patternType ?? "generic"}`,
      });
    } catch (err) {
      scores.push({
        field: "chartData:build",
        pass: false,
        expected: "no crash",
        actual: `Error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return scores;
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function runFixture(fixture: Fixture): Promise<FixtureResult> {
  const imagePath = path.join(FIXTURES_DIR, fixture.image);
  if (!existsSync(imagePath)) {
    return {
      id: fixture.id,
      scores: [{ field: "image", pass: false, expected: fixture.image, actual: "FILE NOT FOUND" }],
      passed: 0, failed: 1, accuracy: 0, processingTimeMs: 0,
    };
  }

  const imageBuffer = await readFile(imagePath);
  const imageBase64 = imageBuffer.toString("base64");
  const ext = path.extname(fixture.image).toLowerCase();
  const mediaType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".webp" ? "image/webp"
    : ext === ".gif" ? "image/gif"
    : "image/png";

  let nlpRaw: Record<string, unknown>;
  let geometry: ChartGeometry | null = null;
  let processingTimeMs = 0;

  if (isLive) {
    // ── Live mode: call APIs ──
    console.log(`    Calling Vision API...`);
    const nlpResult = await callVisionAPI(imageBase64, mediaType);
    nlpRaw = nlpResult.raw;
    processingTimeMs += nlpResult.processingTimeMs;

    console.log(`    Calling geometry extraction...`);
    const geoStart = Date.now();
    geometry = await callGeometryExtraction(
      imageBase64,
      mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif"
    );
    processingTimeMs += Date.now() - geoStart;

    if (saveSnapshots) {
      const snapshot: Snapshot = {
        nlp: {
          raw: nlpRaw,
          timestamp: new Date().toISOString(),
          model: VISION_MODEL,
          processingTimeMs: nlpResult.processingTimeMs,
        },
        geometry: {
          geometry,
          timestamp: new Date().toISOString(),
        },
      };
      await saveSnapshot(fixture.id, snapshot);
      console.log(`    Snapshot saved.`);
    }
  } else {
    // ── Replay mode: load cached snapshot ──
    const snapshot = await loadSnapshot(fixture.id);
    if (!snapshot) {
      return {
        id: fixture.id,
        scores: [{
          field: "snapshot",
          pass: false,
          expected: "cached snapshot",
          actual: `No snapshot found. Run with --live first to generate: npx tsx tests/image-analysis/run.ts --live`,
        }],
        passed: 0, failed: 1, accuracy: 0, processingTimeMs: 0,
      };
    }
    nlpRaw = snapshot.nlp.raw;
    geometry = snapshot.geometry.geometry;
    processingTimeMs = snapshot.nlp.processingTimeMs;
  }

  const scores = scoreFixture(fixture, nlpRaw, geometry);
  const passed = scores.filter((s) => s.pass).length;
  const failed = scores.filter((s) => !s.pass).length;
  const accuracy = scores.length > 0 ? passed / scores.length : 1;

  return { id: fixture.id, scores, passed, failed, accuracy, processingTimeMs };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Image Analysis Quality Tests                    ║`);
  console.log(`║  Mode: ${isLive ? "LIVE (API calls)" : "REPLAY (cached snapshots)"}${" ".repeat(isLive ? 16 : 10)}║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  if (isLive && (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.startsWith("your-"))) {
    console.error("Error: A real ANTHROPIC_API_KEY is required for --live mode.");
    console.error("Set it in .env.local or as an environment variable.");
    process.exit(1);
  }

  const fixturesRaw = await readFile(
    path.join(FIXTURES_DIR, "image-fixtures.json"),
    "utf-8"
  );
  const allFixtures: (Fixture | { _comment?: string; _example?: unknown })[] = JSON.parse(fixturesRaw);

  // Filter out comments/examples, apply --filter
  const fixtures = allFixtures.filter(
    (f): f is Fixture => "id" in f && "image" in f && "expected" in f
  ).filter(
    (f) => !filterArg || f.id.includes(filterArg)
  );

  if (fixtures.length === 0) {
    console.log("No fixtures to run.");
    console.log("\nTo get started:");
    console.log("  1. Drop chart screenshots into tests/image-analysis/fixtures/images/");
    console.log("  2. Add entries to tests/image-analysis/fixtures/image-fixtures.json");
    console.log("  3. Run: npx tsx tests/image-analysis/run.ts --live");
    console.log("\nSee the _example entry in image-fixtures.json for the fixture format.");
    process.exit(0);
  }

  console.log(`Running ${fixtures.length} fixture(s)...\n`);

  const results: FixtureResult[] = [];

  for (const fixture of fixtures) {
    console.log(`  ┌─ ${fixture.id}`);
    if (fixture.expected.notes) {
      console.log(`  │  ${fixture.expected.notes}`);
    }

    const result = await runFixture(fixture);
    results.push(result);

    // Print per-field results
    for (const score of result.scores) {
      const icon = score.pass ? "✓" : "✗";
      const color = score.pass ? "\x1b[32m" : "\x1b[31m";
      const reset = "\x1b[0m";
      if (verbose || !score.pass) {
        console.log(`  │  ${color}${icon}${reset} ${score.field}: ${score.actual}${score.detail ? ` (${score.detail})` : ""}`);
        if (!score.pass) {
          console.log(`  │    expected: ${score.expected}`);
        }
      }
    }

    const pct = (result.accuracy * 100).toFixed(0);
    const accColor = result.accuracy >= 0.8 ? "\x1b[32m" : result.accuracy >= 0.5 ? "\x1b[33m" : "\x1b[31m";
    const reset = "\x1b[0m";
    console.log(`  └─ ${accColor}${pct}%${reset} (${result.passed}/${result.passed + result.failed})${isLive ? ` · ${result.processingTimeMs}ms` : ""}\n`);
  }

  // ── Aggregate report ───────────────────────────────────────────────────────

  const totalPassed = results.reduce((s, r) => s + r.passed, 0);
  const totalFailed = results.reduce((s, r) => s + r.failed, 0);
  const totalChecks = totalPassed + totalFailed;
  const overallAccuracy = totalChecks > 0 ? totalPassed / totalChecks : 1;

  // Per-field aggregate
  const fieldStats = new Map<string, { passed: number; total: number }>();
  for (const r of results) {
    for (const s of r.scores) {
      // Group by field category (e.g. "ticker", "direction", "level:*", "pattern")
      const category = s.field.includes(":") ? s.field.split(":")[0] : s.field;
      const stat = fieldStats.get(category) ?? { passed: 0, total: 0 };
      stat.total++;
      if (s.pass) stat.passed++;
      fieldStats.set(category, stat);
    }
  }

  console.log(`╔══════════════════════════════════════════════════╗`);
  console.log(`║  Results                                         ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  Fixtures: ${fixtures.length}${" ".repeat(38 - String(fixtures.length).length)}║`);
  console.log(`║  Checks:   ${totalChecks} (${totalPassed} passed, ${totalFailed} failed)${" ".repeat(Math.max(0, 26 - String(totalChecks).length - String(totalPassed).length - String(totalFailed).length))}║`);

  const accStr = (overallAccuracy * 100).toFixed(1) + "%";
  const accColor2 = overallAccuracy >= 0.8 ? "\x1b[32m" : overallAccuracy >= 0.5 ? "\x1b[33m" : "\x1b[31m";
  const reset2 = "\x1b[0m";
  console.log(`║  Accuracy: ${accColor2}${accStr}${reset2}${" ".repeat(Math.max(0, 38 - accStr.length))}║`);

  console.log(`╠──────────────────────────────────────────────────╣`);
  console.log(`║  Per-field accuracy:                             ║`);
  for (const [field, stat] of fieldStats.entries()) {
    const pct = ((stat.passed / stat.total) * 100).toFixed(0) + "%";
    const padField = (field + ":").padEnd(20);
    const padPct = pct.padStart(4);
    console.log(`║    ${padField}${padPct} (${stat.passed}/${stat.total})${" ".repeat(Math.max(0, 22 - String(stat.passed).length - String(stat.total).length))}║`);
  }
  console.log(`╚══════════════════════════════════════════════════╝`);

  // ── Fixture accuracy ranking ──
  if (results.length > 1) {
    console.log(`\nFixture ranking (worst → best):`);
    const sorted = [...results].sort((a, b) => a.accuracy - b.accuracy);
    for (const r of sorted) {
      const pct = (r.accuracy * 100).toFixed(0);
      const bar = "█".repeat(Math.round(r.accuracy * 20)) + "░".repeat(20 - Math.round(r.accuracy * 20));
      console.log(`  ${r.id.padEnd(30)} ${bar} ${pct}%`);
    }
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
