/**
 * TradingView Template Stripper
 *
 * Identifies and crops known TradingView UI regions: top toolbar (ticker + timeframe),
 * Y-axis (right), X-axis (bottom), and the core chart area.
 *
 * Runs OCR on the top bar to extract the ticker symbol and timeframe.
 * Returns cropped regions so downstream modules process cleaner data.
 */

import sharp from "sharp";
import Tesseract from "tesseract.js";
import type { ChartRegions } from "./types";

type Worker = Tesseract.Worker;

/**
 * TradingView layout constants (approximate, in pixels).
 * These are calibrated for standard TradingView screenshots at 1x resolution.
 * Larger screenshots scale proportionally — we detect edges dynamically where possible.
 */
const TV_DEFAULTS = {
  /** Height of the top toolbar (ticker, timeframe, indicator labels) */
  topBarHeight: 50,
  /** Width of the right Y-axis price column */
  yAxisWidth: 70,
  /** Height of the bottom X-axis date labels */
  xAxisHeight: 30,
  /** TradingView dark theme background color range */
  bgDark: { r: [13, 25], g: [17, 30], b: [27, 45] },
};

/** Known ticker-like patterns from TradingView headers */
const TICKER_PATTERN = /\b([A-Z]{1,5})\b/;

/** Known timeframe labels from TradingView */
const TIMEFRAME_LABELS = new Set([
  "1",
  "3",
  "5",
  "15",
  "30",
  "45",
  "1H",
  "2H",
  "3H",
  "4H",
  "D",
  "W",
  "M",
  "1D",
  "1W",
  "1M",
]);
const TIMEFRAME_PATTERN =
  /\b(1[5]?|3[0]?|[5]|45|[1-4]H|[DWM]|1[DWM])\b/i;

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
 * Detect the top toolbar height by scanning for the first row of predominantly
 * dark pixels (the chart area). Falls back to the default if detection fails.
 */
async function detectTopBarHeight(
  imageBuffer: Buffer,
  width: number,
  height: number
): Promise<number> {
  const rgba = await sharp(imageBuffer).ensureAlpha().raw().toBuffer();
  const { bgDark } = TV_DEFAULTS;

  // Scan rows from the top, checking the middle 60% of each row
  const sampleLeft = Math.floor(width * 0.2);
  const sampleRight = Math.floor(width * 0.8);
  const sampleWidth = sampleRight - sampleLeft;

  for (let y = 20; y < Math.min(height, 120); y++) {
    let darkPixels = 0;
    for (let x = sampleLeft; x < sampleRight; x += 3) {
      const offset = (y * width + x) * 4;
      const r = rgba[offset];
      const g = rgba[offset + 1];
      const b = rgba[offset + 2];
      if (
        r >= bgDark.r[0] &&
        r <= bgDark.r[1] &&
        g >= bgDark.g[0] &&
        g <= bgDark.g[1] &&
        b >= bgDark.b[0] &&
        b <= bgDark.b[1]
      ) {
        darkPixels++;
      }
    }
    const darkRatio = darkPixels / (sampleWidth / 3);
    // If >70% of sampled pixels match the dark bg, this is the chart area start
    if (darkRatio > 0.7) {
      return y;
    }
  }

  return TV_DEFAULTS.topBarHeight;
}

/**
 * Extract ticker and timeframe from OCR'd text of the top toolbar.
 */
function parseTopBarText(text: string): {
  ticker: string | null;
  timeframe: string | null;
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let ticker: string | null = null;
  let timeframe: string | null = null;

  for (const line of lines) {
    // Look for ticker pattern — prefer the first match
    if (!ticker) {
      const tickerMatch = line.match(TICKER_PATTERN);
      // Filter out common false positives from TradingView UI
      if (tickerMatch) {
        const candidate = tickerMatch[1];
        const falsePositives = new Set([
          "LOG",
          "VOL",
          "RSI",
          "SMA",
          "EMA",
          "ADX",
          "ATR",
          "MACD",
          "BB",
          "OBV",
        ]);
        if (!falsePositives.has(candidate)) {
          ticker = candidate;
        }
      }
    }

    // Look for timeframe
    if (!timeframe) {
      const tfMatch = line.match(TIMEFRAME_PATTERN);
      if (tfMatch) {
        timeframe = tfMatch[1].toUpperCase();
        // Normalize: "1D" → "D", "1W" → "W", "1M" → "M"
        if (timeframe === "1D") timeframe = "D";
        if (timeframe === "1W") timeframe = "W";
        if (timeframe === "1M") timeframe = "M";
      }
    }
  }

  return { ticker, timeframe };
}

/**
 * Strip TradingView template chrome and return isolated chart regions.
 *
 * @param imageBuffer - Raw chart screenshot buffer (PNG/JPG/WEBP)
 * @returns Chart regions (topBar, yAxis, xAxis, chartArea) with OCR'd ticker/timeframe
 */
export async function stripTradingViewTemplate(
  imageBuffer: Buffer
): Promise<ChartRegions & { ticker: string | null; timeframe: string | null }> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 800;
  const height = metadata.height ?? 600;

  // Detect top bar boundary dynamically
  const topBarH = await detectTopBarHeight(imageBuffer, width, height);
  const yAxisW = Math.min(TV_DEFAULTS.yAxisWidth, Math.floor(width * 0.12));
  const xAxisH = Math.min(TV_DEFAULTS.xAxisHeight, Math.floor(height * 0.08));

  const chartLeft = 0;
  const chartTop = topBarH;
  const chartWidth = width - yAxisW;
  const chartHeight = height - topBarH - xAxisH;

  // Extract all regions in parallel
  const [topBar, yAxis, xAxis, chartArea] = await Promise.all([
    sharp(imageBuffer)
      .extract({ left: 0, top: 0, width, height: topBarH })
      .png()
      .toBuffer(),
    sharp(imageBuffer)
      .extract({
        left: width - yAxisW,
        top: topBarH,
        width: yAxisW,
        height: chartHeight,
      })
      .png()
      .toBuffer(),
    sharp(imageBuffer)
      .extract({
        left: 0,
        top: height - xAxisH,
        width: chartWidth,
        height: xAxisH,
      })
      .png()
      .toBuffer(),
    sharp(imageBuffer)
      .extract({
        left: chartLeft,
        top: chartTop,
        width: Math.max(1, chartWidth),
        height: Math.max(1, chartHeight),
      })
      .png()
      .toBuffer(),
  ]);

  // OCR the top bar for ticker and timeframe
  const worker = await getWorker();
  const topBarInverted = await sharp(topBar)
    .greyscale()
    .negate()
    .sharpen()
    .toBuffer();

  const {
    data: { text },
  } = await worker.recognize(topBarInverted);

  const { ticker, timeframe } = parseTopBarText(text);

  return {
    ticker,
    timeframe,
    topBar,
    yAxis,
    xAxis,
    chartArea,
    bounds: {
      topBar: { y: 0, height: topBarH },
      yAxis: { x: width - yAxisW, width: yAxisW },
      xAxis: { y: height - xAxisH, height: xAxisH },
      chartArea: {
        x: chartLeft,
        y: chartTop,
        width: chartWidth,
        height: chartHeight,
      },
    },
  };
}
