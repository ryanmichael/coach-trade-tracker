/**
 * Coach Profile module
 * Maintains structured knowledge about Coach's trading style, terminology,
 * and chart preferences as a key-value store in the CoachProfile table.
 */

import type { PrismaClient } from "@repo/db";

/** Structured Coach Profile built from CoachProfile table entries */
export interface CoachProfileData {
  terminology: Record<string, string>;
  bias: {
    current: string;
    preferredInstruments: string[];
  };
  chartStyle: {
    platform: string;
    annotationColor: string;
    supportResistanceStyle: string;
    targetIndicator: string;
  };
  methodology: {
    primary: string;
  };
  style: {
    postNumbering: boolean;
    chartPrimary: boolean;
  };
  /** All raw entries keyed by their DB key */
  raw: Record<string, unknown>;
}

/**
 * Load all CoachProfile entries and return as a structured object.
 * Groups entries by key prefix (e.g. "terminology.*" → terminology map).
 * Falls back to sensible defaults if entries are missing.
 */
export async function loadProfile(db: PrismaClient): Promise<CoachProfileData> {
  const entries = await db.coachProfile.findMany();

  const profile: CoachProfileData = {
    terminology: {},
    bias: {
      current: "neutral",
      preferredInstruments: [],
    },
    chartStyle: {
      platform: "TradingView",
      annotationColor: "red",
      supportResistanceStyle: "blue_dashed",
      targetIndicator: "red_arrows",
    },
    methodology: {
      primary: "wyckoff",
    },
    style: {
      postNumbering: false,
      chartPrimary: false,
    },
    raw: {},
  };

  for (const entry of entries) {
    const value = entry.value as unknown;
    profile.raw[entry.key] = value;

    if (entry.key.startsWith("terminology.")) {
      const term = entry.key.replace("terminology.", "");
      profile.terminology[term] = String(value);
    } else if (entry.key === "bias.current") {
      profile.bias.current = String(value);
    } else if (entry.key === "bias.preferred_instruments") {
      profile.bias.preferredInstruments = Array.isArray(value)
        ? value.map(String)
        : [];
    } else if (entry.key === "chart.platform") {
      profile.chartStyle.platform = String(value);
    } else if (entry.key === "chart.annotation_color") {
      profile.chartStyle.annotationColor = String(value);
    } else if (entry.key === "chart.support_resistance_style") {
      profile.chartStyle.supportResistanceStyle = String(value);
    } else if (entry.key === "chart.target_indicator") {
      profile.chartStyle.targetIndicator = String(value);
    } else if (entry.key === "methodology.primary") {
      profile.methodology.primary = String(value);
    } else if (entry.key === "style.post_numbering") {
      profile.style.postNumbering = Boolean(value);
    } else if (entry.key === "style.chart_primary") {
      profile.style.chartPrimary = Boolean(value);
    }
  }

  return profile;
}

/**
 * Upsert a single Coach Profile entry.
 * Increments observationCount on update to track how many times
 * this value has been observed or confirmed.
 */
export async function updateProfile(
  db: PrismaClient,
  key: string,
  value: unknown,
  source: "system_detected" | "user_corrected" | "manual" = "system_detected"
): Promise<void> {
  await db.coachProfile.upsert({
    where: { key },
    create: {
      key,
      value: value as any,
      source,
      confidence: source === "user_corrected" ? 0.95 : 0.6,
      observationCount: 1,
    },
    update: {
      value: value as any,
      source,
      // User corrections get max confidence; observations increment naturally
      ...(source === "user_corrected" ? { confidence: 0.95 } : {}),
      observationCount: { increment: 1 },
    },
  });
}

/**
 * Return all terminology.* entries as a flat map: { abbreviation → full name }.
 * Example: { "SOW": "Sign of Weakness", "LPSY": "Last Point of Supply" }
 */
export async function getTerminology(
  db: PrismaClient
): Promise<Record<string, string>> {
  const entries = await db.coachProfile.findMany({
    where: { key: { startsWith: "terminology." } },
  });

  const map: Record<string, string> = {};
  for (const entry of entries) {
    const term = entry.key.replace("terminology.", "");
    map[term] = String(entry.value);
  }
  return map;
}

/**
 * Return Coach's current directional bias and preferred trading instruments.
 */
export async function getBias(db: PrismaClient): Promise<{
  current: string;
  preferredInstruments: string[];
}> {
  const [biasEntry, instrumentsEntry] = await Promise.all([
    db.coachProfile.findUnique({ where: { key: "bias.current" } }),
    db.coachProfile.findUnique({ where: { key: "bias.preferred_instruments" } }),
  ]);

  return {
    current: biasEntry ? String(biasEntry.value) : "neutral",
    preferredInstruments:
      instrumentsEntry && Array.isArray(instrumentsEntry.value)
        ? (instrumentsEntry.value as string[])
        : [],
  };
}

/**
 * Return Coach's chart annotation style preferences.
 * Used to guide Vision API to look for Coach's specific annotation patterns.
 */
export async function getChartStyle(db: PrismaClient): Promise<{
  platform: string;
  annotationColor: string;
  supportResistanceStyle: string;
  targetIndicator: string;
}> {
  const entries = await db.coachProfile.findMany({
    where: { key: { startsWith: "chart." } },
  });

  const style: Record<string, string> = {};
  for (const entry of entries) {
    const k = entry.key.replace("chart.", "");
    style[k] = String(entry.value);
  }

  return {
    platform: style.platform ?? "TradingView",
    annotationColor: style.annotation_color ?? "red",
    supportResistanceStyle: style.support_resistance_style ?? "blue_dashed",
    targetIndicator: style.target_indicator ?? "red_arrows",
  };
}
