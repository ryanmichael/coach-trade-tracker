// Combines text and image parse results
// Priority: text > image for same field; image fills gaps; conflicts are flagged

import type { MergedParseResult, ParsedTradeData, ImageAnalysisResult } from "@repo/shared";

export class MergeStrategy {
  merge(
    _textResults: ParsedTradeData[],
    _imageResults: ImageAnalysisResult[]
  ): MergedParseResult {
    // TODO: implement merge logic with conflict detection
    return { trades: [], conflicts: [], imageAnalysis: [] };
  }
}
