/**
 * Chart Image Preprocessing Pipeline
 *
 * Orchestrates all preprocessing steps to extract structured data from chart
 * screenshots BEFORE (or instead of) calling the Claude Vision API.
 *
 * Pipeline:
 *   1. TradingView template strip → ticker, timeframe, clean chart area
 *   2. Y-axis OCR → pixel-to-price mapping
 *   3. Color isolation → annotation layer, levels layer, base chart
 *   4. Line detection on annotation + levels layers → horizontal lines with prices
 *   5. Annotation OCR on annotation layer → text labels associated with lines
 *   6. Merge → PreprocessedChartData
 *
 * When preprocessing yields high confidence (3+ price levels, ticker found),
 * it can replace the Vision API entirely. Otherwise, the structured data is
 * injected as context into the Vision prompt to improve accuracy.
 */

import type {
  PreprocessedChartData,
  ColorThresholds,
  DetectedLevel,
} from "./types";
import { DEFAULT_COLOR_THRESHOLDS } from "./types";
import { stripTradingViewTemplate } from "./tv-template-stripper";
import { extractYAxisScale } from "./y-axis-extractor";
import { isolateAnnotationLayers } from "./color-isolator";
import {
  detectAnnotationLines,
  detectSupportResistanceLines,
  linesToPriceLevels,
} from "./line-detector";
import {
  extractAnnotationTexts,
  extractPricesFromAnnotations,
} from "./annotation-ocr";

export type { PreprocessedChartData } from "./types";

/** Minimum detected levels to consider preprocessing high-confidence */
const HIGH_CONFIDENCE_MIN_LEVELS = 3;

/** Minimum overall confidence to skip Vision API */
const HIGH_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Run the full preprocessing pipeline on a chart image.
 *
 * @param imageBuffer - Raw image buffer (PNG/JPG/WEBP)
 * @param colorThresholds - Color thresholds for annotation detection (optional, defaults to Coach's known style)
 * @returns Structured chart data extracted offline
 */
export async function preprocessChartImage(
  imageBuffer: Buffer,
  colorThresholds: ColorThresholds = DEFAULT_COLOR_THRESHOLDS
): Promise<PreprocessedChartData> {
  const startTime = Date.now();

  // Step 1: Strip TradingView template chrome
  const template = await stripTradingViewTemplate(imageBuffer);

  // Step 2 & 3 run in parallel — they don't depend on each other
  const [priceScale, layers] = await Promise.all([
    extractYAxisScale(imageBuffer), // Uses the full image (Y-axis is on the right edge)
    isolateAnnotationLayers(template.chartArea, colorThresholds),
  ]);

  // Step 4: Detect horizontal lines on binary masks (not applied images)
  // Using masks ensures dilated gap-fills show as white, not dark background pixels
  const [annotationLines, levelLines] = await Promise.all([
    detectAnnotationLines(layers.annotationMask),
    detectSupportResistanceLines(layers.levelsMask),
  ]);

  // Offset line Y positions from chart-area-relative to full-image-relative
  // (line detection ran on cropped chartArea, price scale was built from full image)
  const chartAreaOffsetY = template.bounds.chartArea.y;
  const allLines = [...annotationLines, ...levelLines].map((line) => ({
    ...line,
    yPixel: line.yPixel + chartAreaOffsetY,
  }));

  // Step 5: OCR annotation text and associate with nearby lines
  const annotationTexts = await extractAnnotationTexts(
    layers.annotations,
    allLines
  );

  // Step 6: Convert pixel lines to price levels (requires price scale)
  let detectedLevels: DetectedLevel[] = [];
  if (priceScale) {
    detectedLevels = linesToPriceLevels(allLines, priceScale);

    // Enrich levels with annotation text labels
    enrichLevelsWithLabels(detectedLevels, annotationTexts, priceScale);
  }

  // Also check annotation texts for explicit price mentions (e.g., "PT $190")
  // that might not correspond to detected lines
  if (priceScale) {
    const textPrices = extractPricesFromAnnotations(annotationTexts);
    for (const [ann, price] of textPrices) {
      if (price === null) continue;

      // Check if this price is already covered by a detected level
      const alreadyCovered = detectedLevels.some(
        (l) => Math.abs(l.price - price) < 1.0
      );
      if (!alreadyCovered) {
        detectedLevels.push({
          price,
          source: "annotation",
          color: "red",
          label: ann.text,
          confidence: ann.confidence * 0.8, // Slightly lower than line-detected levels
        });
      }
    }
  }

  // Deduplicate levels that are very close in price
  detectedLevels = deduplicateLevels(detectedLevels);

  // Calculate overall confidence
  const confidence = calculateConfidence(
    template.ticker,
    priceScale !== null,
    detectedLevels,
    annotationTexts
  );

  const highConfidence =
    confidence >= HIGH_CONFIDENCE_THRESHOLD &&
    detectedLevels.length >= HIGH_CONFIDENCE_MIN_LEVELS;

  return {
    ticker: template.ticker,
    timeframe: template.timeframe,
    priceScale,
    detectedLevels,
    annotationTexts,
    isolatedAnnotations: layers.annotations,
    cleanChartArea: template.chartArea,
    highConfidence,
    confidence,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Enrich detected price levels with nearby annotation text labels.
 * Matches annotations to levels by proximity in price space.
 */
function enrichLevelsWithLabels(
  levels: DetectedLevel[],
  annotations: ReturnType<typeof extractAnnotationTexts> extends Promise<
    infer T
  >
    ? T
    : never,
  priceScale: NonNullable<PreprocessedChartData["priceScale"]>
): void {
  for (const ann of annotations) {
    if (ann.nearestLineY === null) continue;

    // Find the level closest to this annotation's associated line
    const annPrice = priceScale.pixelToPrice(ann.nearestLineY);
    let bestLevel: DetectedLevel | null = null;
    let bestDist = Infinity;

    for (const level of levels) {
      const dist = Math.abs(level.price - annPrice);
      if (dist < bestDist) {
        bestDist = dist;
        bestLevel = level;
      }
    }

    // Only associate if the price difference is small relative to the scale range
    const scaleRange = priceScale.max - priceScale.min;
    if (bestLevel && bestDist < scaleRange * 0.05) {
      bestLevel.label = ann.text;
      // Labels boost confidence
      bestLevel.confidence = Math.min(1, bestLevel.confidence + 0.1);
    }
  }
}

/**
 * Remove duplicate price levels that are within $1 of each other.
 * Keeps the one with highest confidence.
 */
function deduplicateLevels(levels: DetectedLevel[]): DetectedLevel[] {
  if (levels.length <= 1) return levels;

  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const result: DetectedLevel[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];

    if (Math.abs(curr.price - prev.price) < 1.0) {
      // Merge: keep the higher-confidence one, preserve label if either has one
      if (curr.confidence > prev.confidence) {
        curr.label = curr.label ?? prev.label;
        result[result.length - 1] = curr;
      } else {
        prev.label = prev.label ?? curr.label;
        prev.confidence = Math.max(prev.confidence, curr.confidence);
      }
    } else {
      result.push(curr);
    }
  }

  return result;
}

/**
 * Calculate overall preprocessing confidence.
 * Factors: ticker found, price scale extracted, number of levels, annotation text presence.
 */
function calculateConfidence(
  ticker: string | null,
  hasPriceScale: boolean,
  levels: DetectedLevel[],
  annotations: { text: string; confidence: number }[]
): number {
  let score = 0;

  // Ticker detection: 0.2
  if (ticker) score += 0.2;

  // Price scale extraction: 0.25 (critical for accuracy)
  if (hasPriceScale) score += 0.25;

  // Detected levels: up to 0.3 (diminishing returns past 3)
  const levelScore = Math.min(levels.length / 3, 1) * 0.3;
  score += levelScore;

  // Average level confidence: up to 0.15
  if (levels.length > 0) {
    const avgLevelConf =
      levels.reduce((s, l) => s + l.confidence, 0) / levels.length;
    score += avgLevelConf * 0.15;
  }

  // Annotation text found: 0.1
  if (annotations.length > 0) score += 0.1;

  return Math.min(1, Math.max(0, score));
}

/**
 * Format preprocessing results as context for a Vision API prompt.
 * This is injected when preprocessing confidence is below the threshold
 * and we still want to call Vision, but with our offline data as hints.
 */
export function formatAsVisionContext(data: PreprocessedChartData): string {
  const parts: string[] = [];

  parts.push("PRE-ANALYSIS (from offline image processing — use as hints):");

  if (data.ticker) {
    parts.push(`  Detected ticker: ${data.ticker}`);
  }
  if (data.timeframe) {
    parts.push(`  Detected timeframe: ${data.timeframe}`);
  }

  if (data.detectedLevels.length > 0) {
    parts.push(`  Detected horizontal lines at these price levels:`);
    for (const level of data.detectedLevels) {
      const label = level.label ? ` (label: "${level.label}")` : "";
      const source =
        level.source === "annotation" ? "coach annotation" : "chart line";
      parts.push(
        `    $${level.price.toFixed(2)} — ${source}, ${level.color} color${label} (confidence: ${(level.confidence * 100).toFixed(0)}%)`
      );
    }
    parts.push(
      `  Please CLASSIFY each level as: target, support, resistance, entry, or stop_loss.`
    );
    parts.push(
      `  If you detect additional levels I missed, include them too.`
    );
  }

  if (data.annotationTexts.length > 0) {
    parts.push(`  Detected annotation text on chart:`);
    for (const ann of data.annotationTexts) {
      parts.push(`    "${ann.text}" at position (${ann.bbox.x}, ${ann.bbox.y})`);
    }
  }

  return parts.join("\n");
}
