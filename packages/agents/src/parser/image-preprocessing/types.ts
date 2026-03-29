// Shared types for the image preprocessing pipeline

export interface PriceScalePoint {
  /** Y-pixel position in the image */
  pixel: number;
  /** Price value at that position */
  price: number;
}

export interface PriceScale {
  /** Raw data points from Y-axis OCR */
  points: PriceScalePoint[];
  /** Min price visible on the axis */
  min: number;
  /** Max price visible on the axis */
  max: number;
  /** Convert a Y-pixel position to a price value via linear interpolation */
  pixelToPrice: (y: number) => number;
  /** Convert a price value to a Y-pixel position */
  priceToPixel: (price: number) => number;
}

export interface DetectedLine {
  /** Y-pixel position of the line center */
  yPixel: number;
  /** X start position */
  startX: number;
  /** X end position */
  endX: number;
  /** Approximate line thickness in pixels */
  thickness: number;
  /** Dominant color of the line */
  color: "red" | "blue" | "green" | "yellow" | "white" | "other";
}

export interface DetectedLevel {
  /** Price at this level (derived from pixel position + price scale) */
  price: number;
  /** Origin: Coach annotation vs. native chart element */
  source: "annotation" | "support_resistance" | "native";
  /** Color of the detected line */
  color: string;
  /** Nearby OCR text label, if any */
  label: string | null;
  /** Confidence in this detection (0-1) */
  confidence: number;
}

export interface AnnotationText {
  /** OCR'd text content */
  text: string;
  /** Bounding box in the image */
  bbox: { x: number; y: number; width: number; height: number };
  /** Y-pixel of the nearest detected line, if within proximity */
  nearestLineY: number | null;
  /** OCR confidence (0-1) */
  confidence: number;
}

export interface ChartRegions {
  /** Ticker symbol + timeframe bar at top */
  topBar: Buffer;
  /** Y-axis price labels (right side) */
  yAxis: Buffer;
  /** X-axis date/time labels (bottom) */
  xAxis: Buffer;
  /** Core chart area with chrome removed */
  chartArea: Buffer;
  /** Pixel offsets of each region within the original image */
  bounds: {
    topBar: { y: number; height: number };
    yAxis: { x: number; width: number };
    xAxis: { y: number; height: number };
    chartArea: { x: number; y: number; width: number; height: number };
  };
}

export interface IsolatedLayers {
  /** Coach's primary annotation color (typically red) — arrows, text, highlights */
  annotations: Buffer;
  /** Coach's support/resistance lines (typically blue dashed) */
  levels: Buffer;
  /** Base chart with annotations stripped — native TradingView elements only */
  base: Buffer;
  /** Binary mask for red annotations (PNG, white=match) — use for line detection */
  annotationMask: Buffer;
  /** Binary mask for blue levels (PNG, white=match, dilated to close dash gaps) — use for line detection */
  levelsMask: Buffer;
}

export interface PreprocessedChartData {
  /** Ticker symbol extracted from chart header */
  ticker: string | null;
  /** Chart timeframe (e.g., "D", "4H", "1H", "W") */
  timeframe: string | null;
  /** Y-axis price scale mapping */
  priceScale: PriceScale | null;
  /** Price levels detected via line detection + price scale mapping */
  detectedLevels: DetectedLevel[];
  /** Text annotations found on the chart */
  annotationTexts: AnnotationText[];
  /** Isolated annotation layer (for Vision API fallback) */
  isolatedAnnotations: Buffer | null;
  /** Clean chart area with template chrome removed */
  cleanChartArea: Buffer | null;
  /** Whether preprocessing produced high-confidence results */
  highConfidence: boolean;
  /** Overall preprocessing confidence (0-1) */
  confidence: number;
  /** Processing time in ms */
  processingTimeMs: number;
}

/** Color thresholds for isolating annotation channels */
export interface ColorThresholds {
  /** Min R, max G, max B for red annotation detection */
  red: { minR: number; maxG: number; maxB: number };
  /** Max R, max G, min B for blue line detection */
  blue: { maxR: number; maxG: number; minB: number };
}

/** Default thresholds tuned for TradingView dark theme + Coach's annotation style */
export const DEFAULT_COLOR_THRESHOLDS: ColorThresholds = {
  red: { minR: 160, maxG: 100, maxB: 100 },
  blue: { maxR: 100, maxG: 100, minB: 140 },
};
