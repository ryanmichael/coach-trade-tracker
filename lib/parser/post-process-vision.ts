/**
 * Vision Post-Processing Module
 *
 * Pure functions extracted from the image analysis route for unit testing.
 * Handles direction correction, level reclassification, and support-breakdown
 * detection based on vision API output.
 */

export interface PriceLevel {
  value: number;
  type: "target" | "support" | "resistance" | "entry" | "stop_loss" | "unknown";
  label: string | null;
}

export interface PostProcessInput {
  direction: "bullish" | "bearish" | "neutral" | null;
  priceLevels: PriceLevel[];
  annotations: string[];
}

export interface PostProcessResult {
  correctedDirection: "bullish" | "bearish" | "neutral" | null;
  reclassifiedLevels: PriceLevel[];
  supportBreakdownOverride: boolean;
}

/**
 * Detect support breakdown: if annotations mention "CRITICAL SUPPORT" / "KEY SUPPORT"
 * and labeled support levels are ABOVE the entry price, this is a bearish breakdown.
 */
export function detectSupportBreakdown(
  annotations: string[],
  priceLevels: PriceLevel[],
  entryLevel: number | undefined
): { isBreakdown: boolean; brokenLevels: PriceLevel[]; inferredEntry: number | null } {
  const annotationText = annotations.join(" ");
  const hasAnnotation =
    /\bcritical\s+support\b|\bkey\s+support\b|\bcritical\s+level\b/i.test(annotationText) ||
    (/\bcritical\b/i.test(annotationText) && /\bsupport\b/i.test(annotationText));

  if (!hasAnnotation) {
    return { isBreakdown: false, brokenLevels: [], inferredEntry: null };
  }

  // Use explicit entry level if available; otherwise infer from the
  // "critical support" labeled level — price is AT this level, meaning
  // other levels above it are resistance (broken support acts as resistance).
  let refLevel = entryLevel;
  if (!refLevel) {
    const criticalLevel = priceLevels.find(
      (l) => l.label && /critical\s+support|key\s+support/i.test(l.label)
    );
    if (criticalLevel) {
      refLevel = criticalLevel.value;
    }
  }

  if (!refLevel) {
    return { isBreakdown: false, brokenLevels: [], inferredEntry: null };
  }

  const brokenLevels = priceLevels.filter(
    (l) =>
      (l.type === "support" || l.type === "resistance" || l.type === "unknown") &&
      l.value > refLevel! * 1.005 &&
      // Don't count the critical support level itself as "broken"
      l.value !== refLevel
  );

  return {
    isBreakdown: brokenLevels.length > 0,
    brokenLevels,
    inferredEntry: entryLevel ? null : refLevel,
  };
}

/**
 * Infer direction from price level positions relative to entry.
 * Only runs when support-breakdown override hasn't already fired.
 */
export function inferDirectionFromLevels(
  priceLevels: PriceLevel[],
  entryLevel: number | undefined,
  currentDirection: "bullish" | "bearish" | "neutral" | null
): "bullish" | "bearish" | "neutral" | null {
  if (!entryLevel || currentDirection === "neutral") return currentDirection;

  const nonEntryLevels = priceLevels.filter((l) => l.type !== "entry" && l.value > 0);
  if (nonEntryLevels.length < 1) return currentDirection;

  // Filter out levels very close to entry (<=2%)
  const significantLevels = nonEntryLevels.filter(
    (l) => Math.abs(l.value - entryLevel) / entryLevel > 0.02
  );
  const levelsForDirection = significantLevels.length > 0 ? significantLevels : nonEntryLevels;

  // Only use target/resistance/stop_loss/unknown for direction (not raw support)
  const directionalLevels = levelsForDirection.filter(
    (l) => l.type === "target" || l.type === "resistance" || l.type === "stop_loss" || l.type === "unknown"
  );
  const levelsToUse = directionalLevels.length > 0 ? directionalLevels : levelsForDirection;

  const aboveEntry = levelsToUse.filter((l) => l.value > entryLevel).length;
  const belowEntry = levelsToUse.filter((l) => l.value < entryLevel).length;

  if (aboveEntry > 0 && belowEntry === 0) return "bullish";
  if (belowEntry > 0 && aboveEntry === 0) return "bearish";

  return currentDirection;
}

/**
 * Re-classify levels based on confirmed direction + position relative to entry.
 * - Bullish: resistance above entry → target
 * - Bearish: support below entry → target
 * - Neutral: preserve as-is
 */
export function reclassifyLevels(
  priceLevels: PriceLevel[],
  entryLevel: number | undefined,
  direction: "bullish" | "bearish" | "neutral" | null
): PriceLevel[] {
  return priceLevels.map((l) => {
    if (!entryLevel || direction === "neutral") return l;

    if (direction === "bullish" && l.type === "resistance" && l.value > entryLevel) {
      return { ...l, type: "target" as const };
    }
    if (direction === "bearish" && l.type === "support" && l.value < entryLevel) {
      return { ...l, type: "target" as const };
    }
    return l;
  });
}

/**
 * Detect step-down pattern from annotations or level labels.
 * Step-down is inherently bearish — a descending stair-step with
 * diagonal resistance ceiling capping price at progressively lower levels.
 */
function hasStepDownPattern(annotations: string[], priceLevels: PriceLevel[]): boolean {
  const text = [...annotations, ...priceLevels.map((l) => l.label ?? "")].join(" ").toLowerCase();
  return (
    /step.?down/i.test(text) ||
    (/descending\s+(stair|step)/i.test(text)) ||
    // Multiple "Step N" labels indicate step-down structure
    (priceLevels.filter((l) => l.label && /step\s*\d/i.test(l.label)).length >= 2)
  );
}

/**
 * Full post-processing pipeline — runs all corrections in sequence.
 */
export function postProcessVision(input: PostProcessInput): PostProcessResult {
  const { direction, priceLevels, annotations } = input;
  const mutableLevels = priceLevels.map((l) => ({ ...l }));
  const entryLevel = mutableLevels.find((l) => l.type === "entry")?.value;

  // Step 1: Support breakdown detection
  const breakdown = detectSupportBreakdown(annotations, mutableLevels, entryLevel);
  let correctedDirection = direction;
  let supportBreakdownOverride = false;
  let effectiveEntry = entryLevel;

  if (breakdown.isBreakdown) {
    correctedDirection = "bearish";
    supportBreakdownOverride = true;
    breakdown.brokenLevels.forEach((broken) => {
      const match = mutableLevels.find((l) => l.value === broken.value && l.type === broken.type);
      if (match) match.type = "resistance";
    });
    // If Vision didn't set an entry but we inferred one from the critical support label,
    // inject it so downstream processing (reclassification, trade mapping) has it.
    if (breakdown.inferredEntry && !entryLevel) {
      effectiveEntry = breakdown.inferredEntry;
      mutableLevels.push({ value: breakdown.inferredEntry, type: "entry", label: "Inferred from critical support" });
    }
  }

  // Step 1b: Step-down pattern is inherently bearish — override direction
  // regardless of what Vision returned. Step-down = descending stair-step
  // with resistance ceiling, always a bearish continuation pattern.
  if (!supportBreakdownOverride && hasStepDownPattern(annotations, mutableLevels)) {
    correctedDirection = "bearish";
    supportBreakdownOverride = true;
  }

  // Step 2: Position-based direction inference (only if breakdown didn't fire)
  if (!supportBreakdownOverride && correctedDirection !== "neutral") {
    correctedDirection = inferDirectionFromLevels(mutableLevels, effectiveEntry, correctedDirection);
  }

  // Step 3: Level reclassification based on final direction
  const reclassifiedLevels = reclassifyLevels(mutableLevels, effectiveEntry, correctedDirection);

  return {
    correctedDirection,
    reclassifiedLevels,
    supportBreakdownOverride,
  };
}
