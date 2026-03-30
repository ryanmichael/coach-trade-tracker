import type {
  ParsedTradeData,
  ImageAnalysisResult,
  MergeResult,
  ParseConflict,
  SourceType,
} from "./types";

export function mergeResults(
  textTrades: ParsedTradeData[],
  imageResults: ImageAnalysisResult[]
): MergeResult {
  const conflicts: ParseConflict[] = [];

  if (imageResults.length === 0) {
    return { trades: textTrades, conflicts, imageAnalysis: imageResults };
  }

  // Flatten price levels from all images
  const imageLevels = imageResults.flatMap((r) => r.priceLevels);
  const imageTicker = imageResults.find((r) => r.ticker)?.ticker ?? null;
  const imageDirection = imageResults.find((r) => r.direction)?.direction ?? null;

  const imageTarget =
    imageLevels.find((l) => l.type === "target")?.value ?? null;
  const imageConfirmation =
    imageLevels.find((l) => l.type === "entry")?.value ?? null;
  const imageSupport =
    imageLevels.find((l) => l.type === "support")?.value ?? null;
  const imageResistance =
    imageLevels.find((l) => l.type === "resistance")?.value ?? null;
  const imageStopLoss =
    imageLevels.find((l) => l.type === "stop_loss")?.value ?? null;

  // Text found trades — merge image data in
  if (textTrades.length > 0) {
    const merged = textTrades.map((trade) => {
      const result = { ...trade };
      let sourceType: SourceType = "text";

      // priceTargetHigh
      if (!result.priceTargetHigh && imageTarget !== null) {
        result.priceTargetHigh = imageTarget;
        sourceType = "image";
      } else if (result.priceTargetHigh !== null && imageTarget !== null) {
        const diff =
          Math.abs(result.priceTargetHigh - imageTarget) /
          result.priceTargetHigh;
        if (diff > 0.02) {
          conflicts.push({
            field: "priceTargetHigh",
            textValue: result.priceTargetHigh,
            imageValue: imageTarget,
          });
        } else {
          sourceType = "combined";
        }
      }

      // priceConfirmation
      if (!result.priceConfirmation && imageConfirmation !== null) {
        result.priceConfirmation = imageConfirmation;
        if (sourceType === "text") sourceType = "image";
      } else if (
        result.priceConfirmation !== null &&
        imageConfirmation !== null
      ) {
        const diff =
          Math.abs(result.priceConfirmation - imageConfirmation) /
          result.priceConfirmation;
        if (diff > 0.02) {
          conflicts.push({
            field: "priceConfirmation",
            textValue: result.priceConfirmation,
            imageValue: imageConfirmation,
          });
        } else {
          sourceType = "combined";
        }
      }

      // Fill gaps from image
      result.supportLevel = result.supportLevel ?? imageSupport;
      result.resistanceLevel = result.resistanceLevel ?? imageResistance;
      if (!result.stopLoss && imageStopLoss !== null) {
        result.stopLoss = imageStopLoss;
      }

      // Upgrade source if image filled any gap
      if (
        sourceType === "text" &&
        (imageSupport !== null || imageResistance !== null)
      ) {
        sourceType = "combined";
      }

      result.sourceType = sourceType;

      // Boost confidence when sources agree
      if (sourceType === "combined") {
        result.confidence = Math.min(1, result.confidence + 0.1);
      }

      return result;
    });

    return { trades: merged, conflicts, imageAnalysis: imageResults };
  }

  // Text found nothing — build trade from image alone
  if (imageTicker) {
    const imgTrade: ParsedTradeData = {
      ticker: imageTicker,
      direction: imageDirection === "bearish" ? "short" : "long",
      priceTargetLow: null,
      priceTargetHigh: imageTarget,
      priceTargetPercent: null,
      priceConfirmation: imageConfirmation,
      projectedDate: null,
      stopLoss: imageStopLoss,
      supportLevel: imageSupport,
      resistanceLevel: imageResistance,
      confidence: imageResults[0].confidence,
      sourceType: "image",
      rawExtract: imageResults[0].summary,
    };
    return { trades: [imgTrade], conflicts, imageAnalysis: imageResults };
  }

  return { trades: [], conflicts, imageAnalysis: imageResults };
}
