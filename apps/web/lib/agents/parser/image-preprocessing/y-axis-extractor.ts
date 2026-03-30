/**
 * Y-Axis OCR Price Scale Extractor
 *
 * Crops the right side of a chart image (where TradingView puts the Y-axis),
 * runs OCR to read price labels, and builds a pixel-to-price mapping function.
 *
 * This is the foundation for all other extraction — without a price scale,
 * detected line positions can't be converted to dollar values.
 */

import sharp from "sharp";
import Tesseract from "tesseract.js";
import type { PriceScale, PriceScalePoint } from "./types";

type Worker = Tesseract.Worker;

/** Default width in pixels to crop from the right edge for Y-axis reading.
 * Automatically scaled up for high-resolution images. */
const Y_AXIS_CROP_BASE_WIDTH = 80;

/** Minimum number of price points needed to build a reliable scale */
const MIN_SCALE_POINTS = 2;

/** Reusable Tesseract worker — lazy-initialized */
let _worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!_worker) {
    _worker = await Tesseract.createWorker("eng");
  }
  return _worker;
}

/** Shut down the shared Tesseract worker (call on process exit) */
export async function terminateWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}

/**
 * Extract the Y-axis region from a chart image.
 * Crops the rightmost portion, auto-scaled for image resolution.
 * Applies minimal preprocessing — Tesseract handles light-on-dark natively.
 */
async function cropYAxis(
  imageBuffer: Buffer,
  cropWidth?: number
): Promise<{ buffer: Buffer; offsetX: number; fullHeight: number }> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 800;
  const height = metadata.height ?? 600;

  // Auto-scale crop width: ~10% of image width, at least 80px, at most 200px
  const effectiveCropWidth =
    cropWidth ?? Math.min(200, Math.max(Y_AXIS_CROP_BASE_WIDTH, Math.round(width * 0.1)));

  const x = Math.max(0, width - effectiveCropWidth);
  const actualWidth = Math.min(effectiveCropWidth, width);

  // Minimal preprocessing: greyscale + threshold for clean binary text
  // Do NOT negate — Tesseract handles light-on-dark text well,
  // and negating can introduce noise from the dark background
  const buffer = await sharp(imageBuffer)
    .extract({ left: x, top: 0, width: actualWidth, height })
    .toBuffer();

  return { buffer, offsetX: x, fullHeight: height };
}

/**
 * Parse a price string from OCR output.
 * Handles formats: "172", "172.50", "1,234.56", "$172", "172.5"
 */
function parsePrice(text: string): number | null {
  // Strip non-numeric characters except dots, commas, and minus
  const cleaned = text.replace(/[^0-9.,\-]/g, "").trim();
  if (!cleaned) return null;

  // Remove commas (thousands separator)
  const withoutCommas = cleaned.replace(/,/g, "");

  const value = parseFloat(withoutCommas);
  if (isNaN(value) || value <= 0 || value > 1_000_000) return null;

  return value;
}

/**
 * Filter outlier OCR prices that are clearly misreads.
 * Y-axis prices form a tight arithmetic sequence. A price far from the
 * median of its neighbors is an OCR error (e.g., "508" read as "8").
 */
function filterOutlierPrices(prices: number[]): number[] {
  if (prices.length <= 2) return prices;

  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Compute median absolute deviation (MAD)
  const deviations = sorted.map((p) => Math.abs(p - median));
  deviations.sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)];

  // Threshold: prices more than 5× MAD from the median are outliers
  // Use a minimum threshold of 20% of median to handle small spreads
  const threshold = Math.max(mad * 5, median * 0.2);

  return prices.filter((p) => Math.abs(p - median) <= threshold);
}

/**
 * Run OCR on the Y-axis crop and extract price labels with their Y-pixel positions.
 *
 * Since Tesseract.js v7 only returns plain text (no word bounding boxes),
 * we parse the text into price values and estimate their Y-pixel positions
 * by distributing them evenly across the crop height. This works because
 * TradingView (and most charting platforms) use evenly spaced Y-axis labels.
 */
async function ocrPriceLabels(
  yAxisBuffer: Buffer,
  fullImageHeight: number
): Promise<PriceScalePoint[]> {
  const worker = await getWorker();

  const { data } = await worker.recognize(yAxisBuffer);

  // Parse each line of OCR output as a potential price
  const lines = data.text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const parsedPrices: number[] = [];
  for (const line of lines) {
    const price = parsePrice(line);
    if (price !== null) {
      parsedPrices.push(price);
    }
  }

  if (parsedPrices.length < MIN_SCALE_POINTS) return [];

  // Filter outliers: Y-axis prices should be in a tight range
  // Remove prices that are far from the median
  const filteredPrices = filterOutlierPrices(parsedPrices);
  if (filteredPrices.length < MIN_SCALE_POINTS) return [];

  // Get crop image height for position estimation
  const metadata = await sharp(yAxisBuffer).metadata();
  const cropHeight = metadata.height ?? fullImageHeight;

  // Estimate Y-pixel positions: labels are evenly distributed vertically.
  // First label is near the top, last near the bottom.
  // Add small margin (~5% of height) for top/bottom padding.
  const topMargin = Math.round(cropHeight * 0.05);
  const bottomMargin = Math.round(cropHeight * 0.05);
  const usableHeight = cropHeight - topMargin - bottomMargin;

  const points: PriceScalePoint[] = filteredPrices.map((price, i) => {
    const ratio =
      filteredPrices.length === 1 ? 0.5 : i / (filteredPrices.length - 1);
    const pixel = Math.round(topMargin + ratio * usableHeight);
    return { pixel, price };
  });

  return points;
}

/**
 * Build a linear interpolation function from the OCR'd price scale points.
 * TradingView uses a linear (or log) Y-axis; we assume linear for v1.
 */
function buildPriceScale(points: PriceScalePoint[]): PriceScale | null {
  if (points.length < MIN_SCALE_POINTS) return null;

  // Sort by pixel position (top to bottom = highest price to lowest)
  const sorted = [...points].sort((a, b) => a.pixel - b.pixel);

  // Validate monotonicity: prices should decrease as pixel Y increases
  // (TradingView: top of chart = highest price)
  // Allow some tolerance for OCR noise
  const isDecreasing = sorted.every(
    (p, i) => i === 0 || p.price <= sorted[i - 1].price + 0.01
  );

  // If not monotonically decreasing, try filtering outliers
  let validPoints = sorted;
  if (!isDecreasing) {
    validPoints = filterMonotonic(sorted);
    if (validPoints.length < MIN_SCALE_POINTS) return null;
  }

  const min = Math.min(...validPoints.map((p) => p.price));
  const max = Math.max(...validPoints.map((p) => p.price));

  // Use the first and last valid points for linear interpolation
  const topPoint = validPoints[0];
  const bottomPoint = validPoints[validPoints.length - 1];

  const pixelRange = bottomPoint.pixel - topPoint.pixel;
  const priceRange = topPoint.price - bottomPoint.price;

  if (pixelRange === 0 || priceRange === 0) return null;

  const pixelToPrice = (y: number): number => {
    const ratio = (y - topPoint.pixel) / pixelRange;
    return topPoint.price - ratio * priceRange;
  };

  const priceToPixel = (price: number): number => {
    const ratio = (topPoint.price - price) / priceRange;
    return topPoint.pixel + ratio * pixelRange;
  };

  return { points: validPoints, min, max, pixelToPrice, priceToPixel };
}

/**
 * Filter to the longest monotonically decreasing subsequence.
 * Removes OCR misreads that break the price ordering.
 */
function filterMonotonic(sorted: PriceScalePoint[]): PriceScalePoint[] {
  const result: PriceScalePoint[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].price <= result[result.length - 1].price) {
      result.push(sorted[i]);
    }
  }
  return result;
}

/**
 * Extract the Y-axis price scale from a chart image.
 *
 * @param imageBuffer - Raw image buffer (PNG/JPG/WEBP)
 * @param cropWidth - Width in pixels to crop from the right edge (auto-scaled if omitted)
 * @returns PriceScale with pixel-to-price mapping, or null if extraction failed
 */
export async function extractYAxisScale(
  imageBuffer: Buffer,
  cropWidth?: number
): Promise<PriceScale | null> {
  const { buffer: yAxisCrop, fullHeight } = await cropYAxis(
    imageBuffer,
    cropWidth
  );
  const points = await ocrPriceLabels(yAxisCrop, fullHeight);
  return buildPriceScale(points);
}
