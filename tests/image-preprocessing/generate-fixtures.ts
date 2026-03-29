/**
 * Generate synthetic TradingView-style chart images for testing the
 * image preprocessing pipeline. Each image has known ground truth
 * (exact line positions, prices, annotations) so we can validate
 * extraction accuracy.
 *
 * Run: npx tsx tests/image-preprocessing/generate-fixtures.ts
 */

import sharp from "sharp";
import { writeFile } from "fs/promises";
import path from "path";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

// TradingView dark theme colors
const TV_BG = { r: 19, g: 23, b: 34 }; // #131722
const TV_TOOLBAR = { r: 30, g: 33, b: 45 }; // toolbar bg
const TV_GRID = { r: 42, g: 46, b: 57 }; // grid lines
const TV_TEXT = { r: 209, g: 212, b: 220 }; // axis labels
const RED_ANNOTATION = { r: 234, g: 57, b: 67 }; // Coach's red
const BLUE_LINE = { r: 41, g: 98, b: 255 }; // Coach's blue S/R

interface FixtureSpec {
  name: string;
  width: number;
  height: number;
  topBarHeight: number;
  yAxisWidth: number;
  xAxisHeight: number;
  ticker: string;
  timeframe: string;
  priceRange: { min: number; max: number };
  /** Horizontal lines to draw: price + color */
  lines: { price: number; color: "red" | "blue"; label?: string }[];
  /** Expected output for validation */
  expected: {
    ticker: string;
    timeframe: string;
    levelCount: number;
    prices: number[];
  };
}

const FIXTURES: FixtureSpec[] = [
  {
    name: "chart-001-aapl-basic",
    width: 800,
    height: 500,
    topBarHeight: 45,
    yAxisWidth: 65,
    xAxisHeight: 28,
    ticker: "AAPL",
    timeframe: "D",
    priceRange: { min: 160, max: 200 },
    lines: [
      { price: 172, color: "red", label: "ENTRY" },
      { price: 190, color: "red", label: "TARGET" },
    ],
    expected: {
      ticker: "AAPL",
      timeframe: "D",
      levelCount: 2,
      prices: [172, 190],
    },
  },
  {
    name: "chart-002-tsla-three-levels",
    width: 800,
    height: 500,
    topBarHeight: 45,
    yAxisWidth: 65,
    xAxisHeight: 28,
    ticker: "TSLA",
    timeframe: "4H",
    priceRange: { min: 850, max: 950 },
    lines: [
      { price: 875, color: "blue" },
      { price: 895, color: "red", label: "BUY" },
      { price: 920, color: "red", label: "TARGET" },
    ],
    expected: {
      ticker: "TSLA",
      timeframe: "4H",
      levelCount: 3,
      prices: [875, 895, 920],
    },
  },
  {
    name: "chart-003-nvda-minimal",
    width: 800,
    height: 500,
    topBarHeight: 45,
    yAxisWidth: 65,
    xAxisHeight: 28,
    ticker: "NVDA",
    timeframe: "D",
    priceRange: { min: 260, max: 320 },
    lines: [{ price: 285, color: "red" }],
    expected: {
      ticker: "NVDA",
      timeframe: "D",
      levelCount: 1,
      prices: [285],
    },
  },
  {
    name: "chart-004-sox-many-levels",
    width: 800,
    height: 500,
    topBarHeight: 45,
    yAxisWidth: 65,
    xAxisHeight: 28,
    ticker: "SOX",
    timeframe: "W",
    priceRange: { min: 4200, max: 5200 },
    lines: [
      { price: 4400, color: "blue" },
      { price: 4600, color: "red", label: "STOP" },
      { price: 4850, color: "red", label: "ENTRY" },
      { price: 5050, color: "red", label: "PT" },
      { price: 5150, color: "blue" },
    ],
    expected: {
      ticker: "SOX",
      timeframe: "W",
      levelCount: 5,
      prices: [4400, 4600, 4850, 5050, 5150],
    },
  },
  {
    name: "chart-005-meta-wide",
    width: 1200,
    height: 600,
    topBarHeight: 50,
    yAxisWidth: 70,
    xAxisHeight: 30,
    ticker: "META",
    timeframe: "D",
    priceRange: { min: 460, max: 540 },
    lines: [
      { price: 480, color: "red", label: "TARGET" },
      { price: 510, color: "red", label: "CONFIRMED" },
    ],
    expected: {
      ticker: "META",
      timeframe: "D",
      levelCount: 2,
      prices: [480, 510],
    },
  },
];

/**
 * Convert a price to a Y pixel position within the chart area.
 */
function priceToY(
  price: number,
  range: { min: number; max: number },
  chartTop: number,
  chartHeight: number
): number {
  const ratio = (range.max - price) / (range.max - range.min);
  return Math.round(chartTop + ratio * chartHeight);
}

/**
 * Create an SVG for a synthetic TradingView chart, then render to PNG via Sharp.
 */
async function generateFixture(spec: FixtureSpec): Promise<Buffer> {
  // Generate at 2x resolution for better OCR, then keep at that size
  const scale = 2;
  const w = spec.width * scale;
  const h = spec.height * scale;
  const topBarH = spec.topBarHeight * scale;
  const yAxisW = spec.yAxisWidth * scale;
  const xAxisH = spec.xAxisHeight * scale;

  const chartTop = topBarH;
  const chartHeight = h - topBarH - xAxisH;
  const chartRight = w - yAxisW;

  // Build SVG at 2x scale for clear OCR
  const svgParts: string[] = [];

  // Background
  svgParts.push(
    `<rect width="${w}" height="${h}" fill="rgb(${TV_BG.r},${TV_BG.g},${TV_BG.b})" />`
  );

  // Top toolbar background
  svgParts.push(
    `<rect width="${w}" height="${topBarH}" fill="rgb(${TV_TOOLBAR.r},${TV_TOOLBAR.g},${TV_TOOLBAR.b})" />`
  );

  // Ticker + timeframe text in toolbar (large, clear text for OCR)
  svgParts.push(
    `<text x="${30 * scale}" y="${topBarH - 20 * scale}" font-family="Arial, sans-serif" font-size="${18 * scale}" font-weight="bold" fill="rgb(${TV_TEXT.r},${TV_TEXT.g},${TV_TEXT.b})">${spec.ticker}</text>`
  );
  svgParts.push(
    `<text x="${90 * scale}" y="${topBarH - 20 * scale}" font-family="Arial, sans-serif" font-size="${14 * scale}" fill="rgb(150,153,165)">${spec.timeframe}</text>`
  );

  // Y-axis price labels (6 evenly spaced)
  const { min, max } = spec.priceRange;
  const priceStep = (max - min) / 5;
  for (let i = 0; i <= 5; i++) {
    const price = max - i * priceStep;
    const y = priceToY(price, spec.priceRange, chartTop, chartHeight);
    // Grid line
    svgParts.push(
      `<line x1="0" y1="${y}" x2="${chartRight}" y2="${y}" stroke="rgb(${TV_GRID.r},${TV_GRID.g},${TV_GRID.b})" stroke-width="1" />`
    );
    // Price label on Y-axis — large clear monospace for OCR
    const priceText =
      price >= 1000 ? price.toFixed(0) : price.toFixed(price % 1 === 0 ? 0 : 2);
    svgParts.push(
      `<text x="${chartRight + 10}" y="${y + 5}" font-family="Courier, monospace" font-size="${14 * scale}" fill="rgb(${TV_TEXT.r},${TV_TEXT.g},${TV_TEXT.b})">${priceText}</text>`
    );
  }

  // Annotation lines (red/blue horizontal) — thick for detection
  for (const line of spec.lines) {
    const y = priceToY(line.price, spec.priceRange, chartTop, chartHeight);
    const color =
      line.color === "red"
        ? `rgb(${RED_ANNOTATION.r},${RED_ANNOTATION.g},${RED_ANNOTATION.b})`
        : `rgb(${BLUE_LINE.r},${BLUE_LINE.g},${BLUE_LINE.b})`;
    const dash = line.color === "blue" ? ` stroke-dasharray="${12},${6}"` : "";

    svgParts.push(
      `<line x1="${40}" y1="${y}" x2="${chartRight - 40}" y2="${y}" stroke="${color}" stroke-width="${3 * scale}"${dash} />`
    );

    // Label annotation text if present
    if (line.label) {
      svgParts.push(
        `<text x="${60}" y="${y - 12}" font-family="Arial, sans-serif" font-size="${14 * scale}" font-weight="bold" fill="${color}">${line.label}</text>`
      );
    }
  }

  // Bottom X-axis area
  svgParts.push(
    `<rect x="0" y="${h - xAxisH}" width="${chartRight}" height="${xAxisH}" fill="rgb(${TV_BG.r},${TV_BG.g},${TV_BG.b})" />`
  );

  // A few fake date labels
  const dates = ["Mar 10", "Mar 11", "Mar 12", "Mar 13", "Mar 14"];
  const dateSpacing = chartRight / (dates.length + 1);
  for (let i = 0; i < dates.length; i++) {
    svgParts.push(
      `<text x="${(i + 1) * dateSpacing}" y="${h - 12}" font-family="Arial, sans-serif" font-size="${12 * scale}" fill="rgb(150,153,165)" text-anchor="middle">${dates[i]}</text>`
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svgParts.join("")}</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  console.log(`Generating ${FIXTURES.length} synthetic chart fixtures...`);

  for (const spec of FIXTURES) {
    const png = await generateFixture(spec);
    const imagePath = path.join(FIXTURES_DIR, `${spec.name}.png`);
    const expectedPath = path.join(FIXTURES_DIR, `${spec.name}.expected.json`);

    await writeFile(imagePath, png);
    await writeFile(expectedPath, JSON.stringify(spec.expected, null, 2));

    console.log(`  ✓ ${spec.name}.png (${png.length} bytes)`);
  }

  console.log("Done.");
}

main().catch(console.error);
