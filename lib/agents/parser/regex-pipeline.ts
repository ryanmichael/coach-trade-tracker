// Fast regex-based text extraction — runs in <100ms, no API cost
// Handles: ticker extraction, price targets, confirmation prices, dates, direction, stop loss

import type { ParsedTradeData } from "@/lib/shared/types";

export class RegexPipeline {
  parse(_content: string): ParsedTradeData[] {
    // TODO: implement regex extraction pipeline
    return [];
  }
}
