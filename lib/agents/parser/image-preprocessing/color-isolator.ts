/**
 * Annotation Color Isolation Module
 *
 * Uses Sharp.js to separate Coach's annotations from the native TradingView chart.
 * Coach's known style: red annotations (arrows, text, highlights) and blue dashed
 * support/resistance lines on a dark TradingView background.
 *
 * Outputs separate image buffers for each color channel so downstream modules
 * (line detection, annotation OCR) can process them independently.
 */

import sharp from "sharp";
import type { ColorThresholds, IsolatedLayers } from "./types";
import { DEFAULT_COLOR_THRESHOLDS } from "./types";

/**
 * Isolate pixels matching a color range from a raw RGBA pixel buffer.
 * Returns a new buffer where matching pixels are white (255) and everything
 * else is black (0) — a binary mask suitable for OpenCV or OCR.
 */
function createColorMask(
  rgba: Buffer,
  width: number,
  height: number,
  test: (r: number, g: number, b: number) => boolean
): Buffer {
  const mask = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = rgba[offset];
    const g = rgba[offset + 1];
    const b = rgba[offset + 2];
    mask[i] = test(r, g, b) ? 255 : 0;
  }
  return mask;
}

/**
 * Dilate a binary mask to fill small gaps in detected lines/annotations.
 * Simple 3x3 box dilation — if any neighbor is white, the pixel becomes white.
 */
function dilateMask(
  mask: Buffer,
  width: number,
  height: number,
  iterations: number = 1
): Buffer {
  let current = Buffer.from(mask);
  for (let iter = 0; iter < iterations; iter++) {
    const next = Buffer.alloc(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          for (let dx = -1; dx <= 1 && !hit; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              if (current[ny * width + nx] === 255) hit = true;
            }
          }
        }
        next[y * width + x] = hit ? 255 : 0;
      }
    }
    current = next;
  }
  return current;
}

/**
 * Apply a binary mask to the original image — keep pixels where mask is white,
 * make everything else transparent/black.
 */
async function applyMask(
  originalRgba: Buffer,
  mask: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  const result = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    if (mask[i] === 255) {
      result[offset] = originalRgba[offset];
      result[offset + 1] = originalRgba[offset + 1];
      result[offset + 2] = originalRgba[offset + 2];
      result[offset + 3] = 255;
    }
    // else: stays 0,0,0,0 (transparent black)
  }
  return sharp(result, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Create the "base" layer — the original image with annotation pixels removed.
 * Replaces masked pixels with the background color (dark TradingView bg).
 */
async function createBaseLayer(
  originalRgba: Buffer,
  combinedMask: Buffer,
  width: number,
  height: number,
  bgColor: { r: number; g: number; b: number } = {
    r: 19,
    g: 23,
    b: 34,
  } // TradingView default dark bg
): Promise<Buffer> {
  const result = Buffer.from(originalRgba);
  for (let i = 0; i < width * height; i++) {
    if (combinedMask[i] === 255) {
      const offset = i * 4;
      result[offset] = bgColor.r;
      result[offset + 1] = bgColor.g;
      result[offset + 2] = bgColor.b;
    }
  }
  return sharp(result, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Combine two binary masks with OR logic.
 */
function combineMasks(a: Buffer, b: Buffer): Buffer {
  const result = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] === 255 || b[i] === 255 ? 255 : 0;
  }
  return result;
}

/**
 * Isolate Coach's annotation layers from a chart image.
 *
 * @param imageBuffer - Raw image buffer (PNG/JPG/WEBP)
 * @param thresholds - Color thresholds for annotation detection (defaults to TradingView + Coach style)
 * @returns Three isolated layers: annotations (red), levels (blue), base (remaining chart)
 */
export async function isolateAnnotationLayers(
  imageBuffer: Buffer,
  thresholds: ColorThresholds = DEFAULT_COLOR_THRESHOLDS
): Promise<IsolatedLayers> {
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const rgba = data;

  // Create binary masks for each annotation color
  const redMask = createColorMask(
    rgba,
    width,
    height,
    (r, g, b) =>
      r >= thresholds.red.minR &&
      g <= thresholds.red.maxG &&
      b <= thresholds.red.maxB
  );

  const blueMask = createColorMask(
    rgba,
    width,
    height,
    (r, g, b) =>
      r <= thresholds.blue.maxR &&
      g <= thresholds.blue.maxG &&
      b >= thresholds.blue.minB
  );

  // Dilate masks to capture anti-aliased edges and close gaps in dashed lines
  // Red (solid lines): 1 iteration for anti-aliasing
  // Blue (often dashed): 4 iterations to close ~6px dash gaps
  const redDilated = dilateMask(redMask, width, height, 1);
  const blueDilated = dilateMask(blueMask, width, height, 4);

  // Build output layers in parallel
  const combined = combineMasks(redDilated, blueDilated);

  const [annotations, levels, base, annotationMask, levelsMask] =
    await Promise.all([
      applyMask(rgba, redDilated, width, height),
      applyMask(rgba, blueDilated, width, height),
      createBaseLayer(rgba, combined, width, height),
      sharp(redDilated, { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer(),
      sharp(blueDilated, { raw: { width, height, channels: 1 } })
        .png()
        .toBuffer(),
    ]);

  return { annotations, levels, base, annotationMask, levelsMask };
}
