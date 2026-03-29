/**
 * Annotation Text OCR Extractor
 *
 * Runs Tesseract.js on the isolated red annotation layer to extract Coach's
 * handwritten/typed text annotations (e.g., "BUY HERE →", "TARGET", "PT $190").
 *
 * Associates each text annotation with the nearest detected horizontal line
 * so downstream modules can label price levels.
 */

import Tesseract from "tesseract.js";
import sharp from "sharp";
import type { AnnotationText, DetectedLine } from "./types";

type Worker = Tesseract.Worker;

/** Max vertical distance (px) to associate text with a nearby line */
const LINE_PROXIMITY_THRESHOLD = 30;

/** Minimum OCR confidence to keep a word (0-100 scale from Tesseract) */
const MIN_WORD_CONFIDENCE = 40;

/** Minimum text length to keep (filters single-char noise) */
const MIN_TEXT_LENGTH = 2;

/** Reusable Tesseract worker */
let _worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!_worker) {
    _worker = await Tesseract.createWorker("eng");
  }
  return _worker;
}

export async function terminateWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}

/**
 * Extract text lines from a Tesseract Page result.
 *
 * Tesseract.js v7 only populates `data.text` (blocks is null),
 * so we parse the plain text output and estimate bounding boxes
 * by distributing lines evenly across the image height.
 */
function extractTextLines(
  page: Tesseract.Page,
  imageHeight: number
): { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }[] {
  const results: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }[] = [];

  // Try blocks-based extraction first (future Tesseract versions may restore it)
  if (page.blocks && page.blocks.length > 0) {
    for (const block of page.blocks) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const avgConfidence =
            line.words.reduce((sum: number, w: Tesseract.Word) => sum + w.confidence, 0) /
            (line.words.length || 1);
          if (avgConfidence < MIN_WORD_CONFIDENCE) continue;

          const text = line.words.map((w: Tesseract.Word) => w.text).join(" ").trim();
          if (text.length < MIN_TEXT_LENGTH) continue;

          const x0 = Math.min(...line.words.map((w: Tesseract.Word) => w.bbox.x0));
          const y0 = Math.min(...line.words.map((w: Tesseract.Word) => w.bbox.y0));
          const x1 = Math.max(...line.words.map((w: Tesseract.Word) => w.bbox.x1));
          const y1 = Math.max(...line.words.map((w: Tesseract.Word) => w.bbox.y1));

          results.push({ text, bbox: { x0, y0, x1, y1 }, confidence: avgConfidence });
        }
      }
    }
    if (results.length > 0) return results;
  }

  // Fallback: parse data.text and estimate positions
  const lines = page.text
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length >= MIN_TEXT_LENGTH);

  if (lines.length === 0) return results;

  const lineHeight = Math.round(imageHeight / (lines.length + 1));

  for (let i = 0; i < lines.length; i++) {
    const y = Math.round(lineHeight * (i + 0.5));
    results.push({
      text: lines[i],
      bbox: { x0: 0, y0: y, x1: 200, y1: y + lineHeight },
      confidence: 60, // Default confidence for text-only extraction
    });
  }

  return results;
}

/**
 * Find the nearest horizontal line to a text annotation's vertical position.
 */
function findNearestLine(
  textCenterY: number,
  lines: DetectedLine[]
): number | null {
  let nearest: number | null = null;
  let minDist = LINE_PROXIMITY_THRESHOLD;

  for (const line of lines) {
    const dist = Math.abs(line.yPixel - textCenterY);
    if (dist < minDist) {
      minDist = dist;
      nearest = line.yPixel;
    }
  }

  return nearest;
}

/**
 * Extract text annotations from the isolated annotation layer.
 *
 * @param annotationBuffer - Isolated annotation image (red channel from color-isolator)
 * @param detectedLines - Horizontal lines found by line-detector (for proximity association)
 * @returns Array of annotation texts with positions and nearest line associations
 */
export async function extractAnnotationTexts(
  annotationBuffer: Buffer,
  detectedLines: DetectedLine[] = []
): Promise<AnnotationText[]> {
  // Prepare the annotation image for OCR:
  // - Convert to greyscale
  // - Invert (annotation pixels are colored on dark/transparent bg → need dark-on-light for OCR)
  // - Sharpen for better character recognition
  const prepared = await sharp(annotationBuffer)
    .greyscale()
    .negate()
    .sharpen()
    .toBuffer();

  const metadata = await sharp(annotationBuffer).metadata();
  const imgHeight = metadata.height ?? 600;

  const worker = await getWorker();
  const { data: page } = await worker.recognize(prepared);

  const ocrLines = extractTextLines(page, imgHeight);

  return ocrLines.map((line) => {
    const centerY = Math.round((line.bbox.y0 + line.bbox.y1) / 2);
    const nearestLineY = findNearestLine(centerY, detectedLines);

    return {
      text: cleanAnnotationText(line.text),
      bbox: {
        x: line.bbox.x0,
        y: line.bbox.y0,
        width: line.bbox.x1 - line.bbox.x0,
        height: line.bbox.y1 - line.bbox.y0,
      },
      nearestLineY,
      confidence: line.confidence / 100, // Normalize to 0-1
    };
  });
}

/**
 * Clean up OCR'd annotation text:
 * - Remove common OCR artifacts
 * - Normalize arrow characters
 * - Trim whitespace
 */
function cleanAnnotationText(text: string): string {
  return (
    text
      // Normalize arrow-like characters
      .replace(/[→►▶>]{1,3}/g, "→")
      .replace(/[←◄◀<]{1,3}/g, "←")
      // Remove isolated punctuation noise
      .replace(/^[.\-_|/\\]+$/, "")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Extract price values mentioned in annotation texts.
 * Returns a map of annotation text → extracted price for labels like "PT $190", "$172", "TARGET 190"
 */
export function extractPricesFromAnnotations(
  annotations: AnnotationText[]
): Map<AnnotationText, number | null> {
  const pricePattern = /\$?\s*(\d{1,6}(?:\.\d{1,2})?)/;
  const result = new Map<AnnotationText, number | null>();

  for (const ann of annotations) {
    const match = ann.text.match(pricePattern);
    if (match) {
      const price = parseFloat(match[1]);
      result.set(ann, isNaN(price) || price <= 0 ? null : price);
    } else {
      result.set(ann, null);
    }
  }

  return result;
}
