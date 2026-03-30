/**
 * Image Analyzer — Chart and screenshot analysis
 *
 * Two-pass pipeline:
 * 1. Offline preprocessing (Sharp + Tesseract) — extracts price scale, lines, annotations
 * 2. Claude Vision API — classifies levels and handles ambiguous elements
 *
 * When preprocessing yields high confidence, Vision API can be skipped entirely.
 * When Vision IS called, preprocessing data is injected as context to improve accuracy.
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";
import type { ImageAnalysisResult, PriceLevel } from "@/lib/shared/types";
import {
  preprocessChartImage,
  formatAsVisionContext,
  type PreprocessedChartData,
} from "./image-preprocessing";
import type { DetectedLevel } from "./image-preprocessing/types";

/** Confidence threshold: above this, skip Vision API */
const SKIP_VISION_THRESHOLD = 0.75;

/** Confidence boost applied to preprocessing-confirmed Vision levels */
const PREPROCESSING_CONFIRM_BOOST = 0.15;

/** Price tolerance for matching preprocessing levels to Vision levels */
const PRICE_MATCH_TOLERANCE = 1.5;

export class ImageAnalyzer {
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic();
    }
    return this.client;
  }

  /**
   * Analyze a chart image. Runs offline preprocessing first, then optionally
   * calls Claude Vision API for classification.
   *
   * @param imagePath - Path to the image file
   * @param visionPrompt - Coach-specific or generic Vision prompt
   * @param forceVision - If true, always call Vision API (skip preprocessing shortcut)
   */
  async analyze(
    imagePath: string,
    visionPrompt?: string,
    forceVision: boolean = false
  ): Promise<ImageAnalysisResult & { preprocessed: PreprocessedChartData }> {
    const imageBuffer = await readFile(imagePath);

    // Step 1: Offline preprocessing
    const preprocessed = await preprocessChartImage(imageBuffer);

    // Step 2: Decide whether to call Vision API
    if (
      !forceVision &&
      preprocessed.highConfidence &&
      preprocessed.confidence >= SKIP_VISION_THRESHOLD
    ) {
      // High-confidence offline result — convert directly to ImageAnalysisResult
      return {
        ...offlineToAnalysisResult(preprocessed),
        preprocessed,
      };
    }

    // Step 3: Call Vision API with preprocessing context
    const visionResult = await this.callVisionAPI(
      imageBuffer,
      preprocessed,
      visionPrompt
    );

    // Step 4: Cross-validate and merge
    const merged = crossValidate(visionResult, preprocessed);

    return { ...merged, preprocessed };
  }

  /**
   * Analyze from a Buffer instead of a file path.
   */
  async analyzeBuffer(
    imageBuffer: Buffer,
    visionPrompt?: string,
    forceVision: boolean = false
  ): Promise<ImageAnalysisResult & { preprocessed: PreprocessedChartData }> {
    const preprocessed = await preprocessChartImage(imageBuffer);

    if (
      !forceVision &&
      preprocessed.highConfidence &&
      preprocessed.confidence >= SKIP_VISION_THRESHOLD
    ) {
      return {
        ...offlineToAnalysisResult(preprocessed),
        preprocessed,
      };
    }

    const visionResult = await this.callVisionAPI(
      imageBuffer,
      preprocessed,
      visionPrompt
    );

    const merged = crossValidate(visionResult, preprocessed);
    return { ...merged, preprocessed };
  }

  /**
   * Call Claude Vision API with the image and preprocessing context.
   */
  private async callVisionAPI(
    imageBuffer: Buffer,
    preprocessed: PreprocessedChartData,
    visionPrompt?: string
  ): Promise<ImageAnalysisResult> {
    const client = this.getClient();

    // Build the prompt with preprocessing context injected
    const contextBlock = formatAsVisionContext(preprocessed);
    const prompt = visionPrompt
      ? `${contextBlock}\n\n---\n\n${visionPrompt}`
      : `${contextBlock}\n\n---\n\nAnalyze this trading chart image. Return ONLY valid JSON with: image_type, ticker, price_levels (array of {value, type, label}), annotations, timeframe, direction, projected_dates, confidence, summary.`;

    const base64 = imageBuffer.toString("base64");
    const mediaType = detectMediaType(imageBuffer);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    // Extract JSON from response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return emptyResult("No text response from Vision API");
    }

    return parseVisionResponse(textBlock.text);
  }
}

/**
 * Convert offline preprocessing results to an ImageAnalysisResult.
 * Used when preprocessing confidence is high enough to skip Vision API.
 */
function offlineToAnalysisResult(
  data: PreprocessedChartData
): ImageAnalysisResult {
  const priceLevels: PriceLevel[] = data.detectedLevels.map((level) => ({
    value: level.price,
    type: classifyLevelHeuristic(level, data.detectedLevels),
    label: level.label,
  }));

  return {
    imageType: data.detectedLevels.length > 0 ? "annotated_chart" : "stock_chart",
    ticker: data.ticker,
    priceLevels,
    annotations: data.annotationTexts.map((a) => a.text),
    timeframe: data.timeframe,
    direction: inferDirection(priceLevels),
    projectedDates: [],
    confidence: data.confidence,
    summary: buildOfflineSummary(data),
  };
}

/**
 * Heuristic classification when Vision API is skipped.
 * Uses position relative to other levels and annotation text hints.
 */
function classifyLevelHeuristic(
  level: DetectedLevel,
  allLevels: DetectedLevel[]
): PriceLevel["type"] {
  const label = level.label?.toUpperCase() ?? "";

  // Text-based classification
  if (label.includes("TARGET") || label.includes("PT")) return "target";
  if (label.includes("STOP") || label.includes("SL")) return "stop_loss";
  if (label.includes("BUY") || label.includes("ENTRY") || label.includes("CONFIRM"))
    return "entry";
  if (label.includes("SUPPORT")) return "support";
  if (label.includes("RESIST")) return "resistance";

  // Position-based: sort all levels by price
  const sorted = [...allLevels].sort((a, b) => a.price - b.price);
  const idx = sorted.indexOf(level);
  const total = sorted.length;

  if (total <= 1) return "unknown";
  if (total === 2) {
    // Two levels: higher is likely target, lower is likely entry/support
    return idx === total - 1 ? "target" : "entry";
  }

  // Three+ levels: highest = target, middle = entry, lowest = stop_loss (for longs)
  if (idx === total - 1) return "target";
  if (idx === 0) return "stop_loss";
  return "entry";
}

/**
 * Infer trade direction from classified price levels.
 */
function inferDirection(levels: PriceLevel[]): "bullish" | "bearish" | null {
  const entry = levels.find((l) => l.type === "entry");
  const target = levels.find((l) => l.type === "target");

  if (entry && target) {
    return target.value > entry.value ? "bullish" : "bearish";
  }
  return null;
}

/**
 * Cross-validate Vision API results against preprocessing detections.
 * - Preprocessing-confirmed levels get a confidence boost
 * - Price values from preprocessing are trusted over Vision (deterministic)
 * - Vision-only levels are kept but at original confidence
 */
function crossValidate(
  vision: ImageAnalysisResult,
  preprocessed: PreprocessedChartData
): ImageAnalysisResult {
  const validatedLevels: PriceLevel[] = [];

  for (const vLevel of vision.priceLevels) {
    // Check if preprocessing detected a similar level
    const match = preprocessed.detectedLevels.find(
      (p) => Math.abs(p.price - vLevel.value) < PRICE_MATCH_TOLERANCE
    );

    if (match) {
      // Use preprocessing's price (more precise) with Vision's classification
      validatedLevels.push({
        value: match.price, // Deterministic value from pixel analysis
        type: vLevel.type, // Classification from Vision
        label: vLevel.label ?? match.label,
      });
    } else {
      // Vision-only detection — keep as-is
      validatedLevels.push(vLevel);
    }
  }

  // Add preprocessing levels that Vision missed
  for (const pLevel of preprocessed.detectedLevels) {
    const alreadyIncluded = validatedLevels.some(
      (v) => Math.abs(v.value - pLevel.price) < PRICE_MATCH_TOLERANCE
    );
    if (!alreadyIncluded) {
      validatedLevels.push({
        value: pLevel.price,
        type: classifyLevelHeuristic(pLevel, preprocessed.detectedLevels),
        label: pLevel.label,
      });
    }
  }

  // Boost confidence when preprocessing confirms Vision
  const matchCount = vision.priceLevels.filter((v) =>
    preprocessed.detectedLevels.some(
      (p) => Math.abs(p.price - v.value) < PRICE_MATCH_TOLERANCE
    )
  ).length;

  const confidenceBoost =
    matchCount > 0
      ? Math.min(PREPROCESSING_CONFIRM_BOOST, matchCount * 0.05)
      : 0;

  return {
    ...vision,
    ticker: vision.ticker ?? preprocessed.ticker,
    timeframe: vision.timeframe ?? preprocessed.timeframe,
    priceLevels: validatedLevels,
    confidence: Math.min(1, vision.confidence + confidenceBoost),
  };
}

/**
 * Parse Vision API JSON response, handling markdown code fences.
 */
function parseVisionResponse(text: string): ImageAnalysisResult {
  // Strip markdown code fences if present
  let json = text.trim();
  if (json.startsWith("```")) {
    json = json.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(json);
    return {
      imageType: parsed.image_type ?? "other",
      ticker: parsed.ticker ?? null,
      priceLevels: (parsed.price_levels ?? []).map(
        (l: { value: number; type: string; label: string | null }) => ({
          value: l.value,
          type: l.type as PriceLevel["type"],
          label: l.label ?? null,
        })
      ),
      annotations: parsed.annotations ?? [],
      timeframe: parsed.timeframe ?? null,
      direction: parsed.direction ?? null,
      projectedDates: parsed.projected_dates ?? [],
      confidence: parsed.confidence ?? 0,
      summary: parsed.summary ?? "",
    };
  } catch {
    return emptyResult(`Failed to parse Vision response: ${text.slice(0, 100)}`);
  }
}

function emptyResult(summary: string): ImageAnalysisResult {
  return {
    imageType: "other",
    ticker: null,
    priceLevels: [],
    annotations: [],
    timeframe: null,
    direction: null,
    projectedDates: [],
    confidence: 0,
    summary,
  };
}

function buildOfflineSummary(data: PreprocessedChartData): string {
  const parts: string[] = [];
  if (data.ticker) parts.push(`${data.ticker}`);
  if (data.timeframe) parts.push(`${data.timeframe} chart`);
  parts.push(
    `${data.detectedLevels.length} price level(s) detected via offline analysis`
  );
  parts.push(`(preprocessed in ${data.processingTimeMs}ms)`);
  return parts.join(" — ");
}

function detectMediaType(
  buffer: Buffer
): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
  // Check magic bytes
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46
  )
    return "image/webp";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  return "image/png"; // Default fallback
}
