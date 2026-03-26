// Confidence scoring for parsed trade data
// Scores 0-1 based on field coverage and pattern match quality

import type { ParsedTradeData } from "@/lib/shared/types";

export function scoreConfidence(_trade: Partial<ParsedTradeData>): number {
  // TODO: implement confidence scoring
  return 0.0;
}
