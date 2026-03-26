// Parser-local types — mostly re-exported from @repo/shared
// We keep a local copy here so lib/parser/* can be imported without
// a monorepo package boundary on the server.

export type TradeDirection = "long" | "short";
export type SourceType = "text" | "image" | "combined";

export interface ParsedTradeData {
  ticker: string;
  direction: TradeDirection;
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceTargetPercent: number | null;
  priceConfirmation: number | null;
  /** ISO date string OR human-readable relative string (e.g. "end of month") */
  projectedDate: string | null;
  stopLoss: number | null;
  supportLevel: number | null;
  resistanceLevel: number | null;
  confidence: number; // 0–1
  sourceType: SourceType;
  rawExtract: string;
}

export interface ImagePriceLevel {
  value: number;
  type: "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown";
  label: string | null;
}

export interface ImageAnalysisResult {
  imageType: "stock_chart" | "annotated_chart" | "text_screenshot" | "other";
  ticker: string | null;
  priceLevels: ImagePriceLevel[];
  annotations: string[];
  timeframe: string | null;
  direction: "bullish" | "bearish" | "neutral" | null;
  projectedDates: string[];
  confidence: number;
  summary: string;
}

export interface ParseConflict {
  field: string;
  textValue: number | string | null;
  imageValue: number | string | null;
}

export interface MergeResult {
  trades: ParsedTradeData[];
  conflicts: ParseConflict[];
  imageAnalysis: ImageAnalysisResult[];
}
