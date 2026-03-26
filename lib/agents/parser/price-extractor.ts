// Price level extraction from post text
// Handles: "PT $185-190", "target $150", "confirmed above $145", "SL $130", etc.

export interface ExtractedPrices {
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceTargetPercent: number | null;
  priceConfirmation: number | null;
  stopLoss: number | null;
}

export function extractPrices(_text: string): ExtractedPrices {
  // TODO: implement price extraction
  return {
    priceTargetLow: null,
    priceTargetHigh: null,
    priceTargetPercent: null,
    priceConfirmation: null,
    stopLoss: null,
  };
}
