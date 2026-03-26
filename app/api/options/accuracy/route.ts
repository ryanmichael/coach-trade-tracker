import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/options/accuracy
 *
 * Returns aggregate stats from validated option prediction snapshots.
 * Used for model calibration and future UI confidence indicators.
 */
export async function GET() {
  // All validated snapshots with actual ROI data
  const validated = await prisma.optionsSnapshot.findMany({
    where: {
      validatedAt: { not: null },
      actualROI: { not: null },
    },
    select: {
      ticker: true,
      direction: true,
      forwardROI: true,
      actualROI: true,
      predictionError: true,
      directionCorrect: true,
      ivEstimate: true,
      compositeScore: true,
      isBestMatch: true,
      rank: true,
      createdAt: true,
      validatedAt: true,
    },
  });

  if (validated.length === 0) {
    return NextResponse.json({
      message: "No validated predictions yet",
      totalPredictions: await prisma.optionsSnapshot.count(),
      pendingValidation: await prisma.optionsSnapshot.count({
        where: { validatedAt: null },
      }),
    });
  }

  // Overall accuracy
  const errors = validated.map((v) => v.predictionError ?? 0);
  const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const medianError = errors.sort((a, b) => a - b)[Math.floor(errors.length / 2)];

  // Direction accuracy (did we predict profit/loss correctly?)
  const withDirection = validated.filter((v) => v.directionCorrect !== null);
  const directionCorrectCount = withDirection.filter((v) => v.directionCorrect).length;
  const directionAccuracy = withDirection.length > 0
    ? directionCorrectCount / withDirection.length
    : null;

  // Best match win rate: did rank 1 outperform rank 2+?
  // Group by session-like pattern (same ticker + close timestamps)
  const bestMatches = validated.filter((v) => v.isBestMatch);
  const nonBest = validated.filter((v) => !v.isBestMatch);
  const bestAvgROI = bestMatches.length > 0
    ? bestMatches.reduce((a, v) => a + (v.actualROI ?? 0), 0) / bestMatches.length
    : null;
  const nonBestAvgROI = nonBest.length > 0
    ? nonBest.reduce((a, v) => a + (v.actualROI ?? 0), 0) / nonBest.length
    : null;

  // IV calibration: average estimated IV vs what would have been "right"
  const avgIV = validated.reduce((a, v) => a + v.ivEstimate, 0) / validated.length;

  // ROI prediction scatter: compare predicted vs actual
  const roiPairs = validated.map((v) => ({
    predicted: v.forwardROI,
    actual: v.actualROI ?? 0,
    ticker: v.ticker,
    direction: v.direction,
    rank: v.rank,
  }));

  // By direction breakdown
  const longs = validated.filter((v) => v.direction === "LONG");
  const shorts = validated.filter((v) => v.direction === "SHORT");

  const longAccuracy = longs.filter((v) => v.directionCorrect).length / Math.max(longs.length, 1);
  const shortAccuracy = shorts.filter((v) => v.directionCorrect).length / Math.max(shorts.length, 1);

  return NextResponse.json({
    totalValidated: validated.length,
    totalPredictions: await prisma.optionsSnapshot.count(),
    pendingValidation: await prisma.optionsSnapshot.count({
      where: { validatedAt: null },
    }),
    accuracy: {
      avgPredictionError: Math.round(avgError * 10) / 10,
      medianPredictionError: Math.round(medianError * 10) / 10,
      directionAccuracy: directionAccuracy !== null
        ? Math.round(directionAccuracy * 1000) / 10 + "%"
        : null,
      directionCorrectCount,
      directionTotalChecked: withDirection.length,
    },
    bestMatchPerformance: {
      bestMatchAvgActualROI: bestAvgROI !== null ? Math.round(bestAvgROI * 10) / 10 : null,
      otherAvgActualROI: nonBestAvgROI !== null ? Math.round(nonBestAvgROI * 10) / 10 : null,
      bestMatchOutperforms: bestAvgROI !== null && nonBestAvgROI !== null
        ? bestAvgROI > nonBestAvgROI
        : null,
    },
    byDirection: {
      long: { count: longs.length, directionAccuracy: Math.round(longAccuracy * 1000) / 10 + "%" },
      short: { count: shorts.length, directionAccuracy: Math.round(shortAccuracy * 1000) / 10 + "%" },
    },
    ivCalibration: {
      avgEstimatedIV: Math.round(avgIV * 1000) / 10 + "%",
    },
    roiPairs,
  });
}
