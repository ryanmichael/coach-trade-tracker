/**
 * Horizontal Line Detector
 *
 * Detects horizontal lines in binary mask images (output of color-isolator).
 * Uses a scanline approach: for each row, finds continuous runs of white pixels
 * that span a significant portion of the image width, then clusters nearby
 * detections into single line entries.
 *
 * No OpenCV dependency — pure pixel analysis using Sharp for image loading.
 */

import sharp from "sharp";
import type { DetectedLine, PriceScale, DetectedLevel } from "./types";

/** Minimum width ratio (line width / image width) to consider a detection valid */
const MIN_WIDTH_RATIO = 0.15;

/** Maximum vertical gap (pixels) for clustering nearby detections into one line */
const CLUSTER_GAP = 5;

/** Minimum bright pixels in a row to count as part of a line (filters noise) */
const MIN_RUN_LENGTH = 20;

/**
 * Brightness threshold for detecting "non-background" pixels.
 * After greyscaling, the dark TradingView bg is ~15-25 brightness.
 * Annotation colors (red 234,57,67 → ~111 grey; blue 41,98,255 → ~99 grey)
 * are well above this threshold.
 */
const BRIGHTNESS_THRESHOLD = 50;

/**
 * Find horizontal runs of bright (above threshold) pixels in a single row.
 * Returns runs that meet the minimum length threshold.
 */
function findHorizontalRuns(
  row: Uint8Array,
  width: number,
  minLength: number
): { startX: number; endX: number; length: number }[] {
  const runs: { startX: number; endX: number; length: number }[] = [];
  let runStart = -1;

  for (let x = 0; x <= width; x++) {
    const isBright = x < width && row[x] >= BRIGHTNESS_THRESHOLD;

    if (isBright && runStart === -1) {
      runStart = x;
    } else if (!isBright && runStart !== -1) {
      const length = x - runStart;
      if (length >= minLength) {
        runs.push({ startX: runStart, endX: x - 1, length });
      }
      runStart = -1;
    }
  }

  return runs;
}

/**
 * Scan a binary mask image for horizontal lines.
 * The mask should have white (255) pixels where lines exist and black (0) elsewhere.
 *
 * @param maskBuffer - Binary mask image (PNG, single channel or RGB)
 * @param minWidthRatio - Minimum line width as a fraction of image width (default: 0.15)
 * @returns Array of detected lines with pixel coordinates
 */
export async function detectHorizontalLines(
  maskBuffer: Buffer,
  minWidthRatio: number = MIN_WIDTH_RATIO
): Promise<DetectedLine[]> {
  // Convert to single-channel greyscale
  const { data, info } = await sharp(maskBuffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const minLength = Math.max(MIN_RUN_LENGTH, Math.floor(width * minWidthRatio));

  // Scan each row for horizontal runs
  const rawDetections: {
    yPixel: number;
    startX: number;
    endX: number;
  }[] = [];

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    const row = new Uint8Array(data.buffer, data.byteOffset + rowOffset, width);
    const runs = findHorizontalRuns(row, width, minLength);

    for (const run of runs) {
      rawDetections.push({
        yPixel: y,
        startX: run.startX,
        endX: run.endX,
      });
    }
  }

  // Cluster nearby rows into single line detections
  return clusterDetections(rawDetections, width);
}

/**
 * Cluster adjacent row detections into single line entries.
 * Lines that are within CLUSTER_GAP pixels vertically are merged.
 */
function clusterDetections(
  detections: { yPixel: number; startX: number; endX: number }[],
  imageWidth: number
): DetectedLine[] {
  if (detections.length === 0) return [];

  // Sort by Y position
  const sorted = [...detections].sort((a, b) => a.yPixel - b.yPixel);

  const clusters: { yPixels: number[]; startX: number; endX: number }[] = [];
  let current = {
    yPixels: [sorted[0].yPixel],
    startX: sorted[0].startX,
    endX: sorted[0].endX,
  };

  for (let i = 1; i < sorted.length; i++) {
    const det = sorted[i];
    const lastY = current.yPixels[current.yPixels.length - 1];

    if (det.yPixel - lastY <= CLUSTER_GAP) {
      // Same cluster — extend
      current.yPixels.push(det.yPixel);
      current.startX = Math.min(current.startX, det.startX);
      current.endX = Math.max(current.endX, det.endX);
    } else {
      // New cluster
      clusters.push(current);
      current = {
        yPixels: [det.yPixel],
        startX: det.startX,
        endX: det.endX,
      };
    }
  }
  clusters.push(current);

  // Convert clusters to DetectedLine entries
  return clusters.map((c) => {
    const yMin = Math.min(...c.yPixels);
    const yMax = Math.max(...c.yPixels);
    return {
      yPixel: Math.round((yMin + yMax) / 2),
      startX: c.startX,
      endX: c.endX,
      thickness: yMax - yMin + 1,
      color: "other" as const, // Caller sets this based on which mask was used
    };
  });
}

/**
 * Detect horizontal lines from the red annotation mask.
 * Sets the color to "red" on all detections.
 */
export async function detectAnnotationLines(
  annotationMask: Buffer,
  minWidthRatio?: number
): Promise<DetectedLine[]> {
  const lines = await detectHorizontalLines(annotationMask, minWidthRatio);
  return lines.map((l) => ({ ...l, color: "red" as const }));
}

/**
 * Detect horizontal lines from the blue support/resistance mask.
 * Sets the color to "blue" on all detections.
 */
export async function detectSupportResistanceLines(
  levelsMask: Buffer,
  minWidthRatio?: number
): Promise<DetectedLine[]> {
  const lines = await detectHorizontalLines(levelsMask, minWidthRatio);
  return lines.map((l) => ({ ...l, color: "blue" as const }));
}

/**
 * Convert detected pixel-position lines to price levels using the Y-axis scale.
 *
 * @param lines - Lines detected in pixel space
 * @param priceScale - Pixel-to-price mapping from Y-axis OCR
 * @returns Price levels with confidence scores
 */
export function linesToPriceLevels(
  lines: DetectedLine[],
  priceScale: PriceScale
): DetectedLevel[] {
  return lines.map((line) => {
    const price = priceScale.pixelToPrice(line.yPixel);

    // Confidence factors:
    // - Line width ratio (wider = more confident)
    // - Line thickness (thicker = more prominent)
    // - How well the price fits the scale range
    const widthRatio =
      (line.endX - line.startX) / (line.endX - line.startX + 200);
    const thicknessBonus = Math.min(line.thickness / 5, 0.15);
    const inRange =
      price >= priceScale.min && price <= priceScale.max ? 0.1 : -0.2;

    const confidence = Math.min(
      1,
      Math.max(0, 0.5 + widthRatio * 0.3 + thicknessBonus + inRange)
    );

    return {
      price: Math.round(price * 100) / 100, // Round to cents
      source: line.color === "red" ? "annotation" : "support_resistance",
      color: line.color,
      label: null, // Set later by annotation-ocr module
      confidence,
    } satisfies DetectedLevel;
  });
}
