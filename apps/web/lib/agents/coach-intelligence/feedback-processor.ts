/**
 * Feedback Processor module
 * Processes user-submitted parse corrections (ParseFeedback records) through
 * a pipeline: classify → update ParsedTrade → route to Coach Profile or
 * Knowledge Base → flag for prompt refinement if corrections accumulate.
 *
 * Classification uses Claude to understand freeform feedback and extract
 * structured correction data. All DB writes are idempotent — safe to re-run.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@/generated/prisma";
import { updateProfile } from "./coach-profile";
import { addEntry } from "./knowledge-base";

const CLAUDE_MODEL = "claude-sonnet-4-6";

/** The 5 correction types the system understands */
export type CorrectionType =
  | "terminology"
  | "price_level"
  | "direction"
  | "pattern"
  | "missing_data";

/** Structured output from classifyCorrection() */
export interface ClassifiedCorrection {
  correctionType: CorrectionType;
  /** Which ParsedTrade fields were wrong */
  fieldsCorrected: string[];
  /** Corrected field values to write to ParsedTrade (null if no price/field corrections) */
  correctedValues: Record<string, unknown> | null;
  /** Terminology updates to route to Coach Profile { ABBREVIATION: "Full meaning" } */
  terminologyUpdates: Record<string, string>;
  /** Knowledge Base entries to add or update */
  knowledgeUpdates: Array<{
    category: string;
    key: string;
    data: Record<string, unknown>;
  }>;
}

/**
 * Main feedback pipeline. Orchestrates all steps:
 * a) Load feedback record
 * b) Classify correction via Claude
 * c) Update affected ParsedTrade
 * d) Route terminology corrections → Coach Profile
 * e) Route pattern/instrument corrections → Knowledge Base
 * f) Flag for prompt refinement if 3+ similar corrections exist
 * g) Mark feedback as processed
 */
export async function processFeedback(
  db: PrismaClient,
  feedbackId: string
): Promise<void> {
  // (a) Load feedback
  const feedback = await db.parseFeedback.findUnique({
    where: { id: feedbackId },
    include: { parsedTrade: true },
  });

  if (!feedback) {
    console.error(`[FeedbackProcessor] Feedback not found: ${feedbackId}`);
    return;
  }

  if (feedback.processed) {
    console.log(`[FeedbackProcessor] ${feedbackId} already processed — skipping`);
    return;
  }

  const originalValues = (feedback.originalValues as Record<string, unknown>) ?? {};

  // (b) Classify via Claude
  let classified: ClassifiedCorrection;
  try {
    classified = await classifyCorrection(feedback.feedbackText, originalValues);
  } catch (err) {
    console.error(`[FeedbackProcessor] Classification failed for ${feedbackId}:`, err);
    // Mark processed to avoid infinite retries
    await db.parseFeedback.update({ where: { id: feedbackId }, data: { processed: true } });
    return;
  }

  // Persist the classified metadata on the feedback record
  await db.parseFeedback.update({
    where: { id: feedbackId },
    data: {
      correctionType: classified.correctionType,
      fieldsCorrected: classified.fieldsCorrected,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      correctedValues: classified.correctedValues != null ? (classified.correctedValues as any) : undefined,
    },
  });

  // (c) Update ParsedTrade with corrected values
  if (classified.correctedValues && feedback.parsedTradeId) {
    const updates = buildTradeUpdates(classified.correctedValues);
    if (Object.keys(updates).length > 0) {
      await db.parsedTrade.update({
        where: { id: feedback.parsedTradeId },
        data: updates as any,
      });
      console.log(
        `[FeedbackProcessor] Updated ParsedTrade ${feedback.parsedTradeId}:`,
        Object.keys(updates).join(", ")
      );
    }
  }

  // (d) Route terminology corrections → Coach Profile
  if (
    classified.correctionType === "terminology" &&
    Object.keys(classified.terminologyUpdates).length > 0
  ) {
    for (const [term, meaning] of Object.entries(classified.terminologyUpdates)) {
      await updateProfile(db, `terminology.${term}`, meaning, "user_corrected");
      console.log(`[FeedbackProcessor] Coach Profile updated: terminology.${term} = ${meaning}`);
    }
  }

  // (e) Route pattern/instrument corrections → Knowledge Base
  if (
    (classified.correctionType === "pattern" ||
      classified.correctionType === "missing_data") &&
    classified.knowledgeUpdates.length > 0
  ) {
    for (const entry of classified.knowledgeUpdates) {
      await addEntry(db, entry.category, entry.key, entry.data, "user_added");
      console.log(`[FeedbackProcessor] Knowledge Base updated: ${entry.key}`);
    }
  }

  // (f) Promote repeated corrections to hard prompt rules (threshold: 3+)
  const priorSimilarCount = await db.parseFeedback.count({
    where: {
      id: { not: feedbackId },
      correctionType: classified.correctionType,
      processed: true,
    },
  });

  // priorSimilarCount is the count BEFORE this one is marked processed
  if (priorSimilarCount >= 2) {
    // Analyze and promote — with cooldown to avoid re-running on every subsequent correction
    try {
      await analyzeAndPromoteCorrections(db, classified.correctionType);
    } catch (err) {
      console.warn(`[FeedbackProcessor] Rule promotion failed (non-fatal):`, err);
    }
  }

  // (g) Mark as processed
  await db.parseFeedback.update({
    where: { id: feedbackId },
    data: { processed: true },
  });

  console.log(`[FeedbackProcessor] Feedback ${feedbackId} processed (type: ${classified.correctionType})`);
}

/**
 * Classify freeform feedback text into structured correction data using Claude.
 *
 * Returns the correction type, affected fields, corrected values for ParsedTrade,
 * and any terminology or knowledge base entries that need updating.
 */
export async function classifyCorrection(
  feedbackText: string,
  originalValues: Record<string, unknown>
): Promise<ClassifiedCorrection> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn(
      "[FeedbackProcessor] ANTHROPIC_API_KEY not set — returning empty classification"
    );
    return emptyClassification();
  }

  const anthropic = new Anthropic({ apiKey });

  const systemPrompt = `You are a trading post correction classifier. A user has flagged an AI parsing error and provided freeform feedback.

Your job is to classify the type of correction and extract structured data from the feedback.

Correction types:
- "terminology": The system misunderstood Coach-specific terms (e.g., "SOW means bearish confirmation, not neutral")
- "price_level": A price number was extracted incorrectly (wrong confirmation, target, stop loss, support, or resistance)
- "direction": The trade direction was wrong (long identified as short, or vice versa)
- "pattern": The chart pattern was misidentified or missed entirely
- "missing_data": Important data existed in the post but was not extracted

Return ONLY valid JSON with this exact schema (no markdown, no explanation):
{
  "correctionType": "terminology" | "price_level" | "direction" | "pattern" | "missing_data",
  "fieldsCorrected": ["array of ParsedTrade field names that were wrong"],
  "correctedValues": {
    "ticker": "string or omit if unchanged",
    "direction": "long" | "short" | omit if unchanged,
    "priceConfirmation": number | omit if unchanged,
    "priceTargetHigh": number | omit if unchanged,
    "priceTargetLow": number | omit if unchanged,
    "stopLoss": number | omit if unchanged,
    "supportLevel": number | omit if unchanged,
    "resistanceLevel": number | omit if unchanged
  },
  "terminologyUpdates": {
    "TERM_ABBREV": "Full meaning string"
  },
  "knowledgeUpdates": [
    {
      "category": "pattern" | "instrument" | "term" | "chart_element",
      "key": "unique_snake_case_key",
      "data": { "description": "...", "direction_signal": "..." }
    }
  ]
}

Rules:
- Only include fields in correctedValues that are actually being corrected
- If correctedValues has no fields to correct, set it to null
- terminologyUpdates should only have entries when correctionType is "terminology"
- knowledgeUpdates should only have entries when correctionType is "pattern" or "missing_data"
- fieldsCorrected should list the exact field names from the ParsedTrade schema`;

  const userMessage = `Original parsed values:
${JSON.stringify(originalValues, null, 2)}

User feedback:
"${feedbackText}"

Classify this correction and extract structured data.`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error(`Unexpected content type: ${content.type}`);
    }

    // Strip markdown code blocks if present
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in Claude response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as ClassifiedCorrection;

    // Normalise: ensure required fields exist with safe defaults
    return {
      correctionType: parsed.correctionType ?? "missing_data",
      fieldsCorrected: parsed.fieldsCorrected ?? [],
      correctedValues: parsed.correctedValues ?? null,
      terminologyUpdates: parsed.terminologyUpdates ?? {},
      knowledgeUpdates: parsed.knowledgeUpdates ?? [],
    };
  } catch (err) {
    console.error("[FeedbackProcessor] Claude classification error:", err);
    return emptyClassification();
  }
}

// ── Rule Promotion ────────────────────────────────────────────────────────────

/**
 * Analyze accumulated corrections of a given type and promote patterns to
 * hard prompt rules stored in CoachProfile under `prompt.rule.{type}.*`.
 *
 * Includes a cooldown: only re-runs if there are new corrections since the
 * last analysis, preventing redundant Claude calls on every subsequent correction.
 */
export async function analyzeAndPromoteCorrections(
  db: PrismaClient,
  correctionType: CorrectionType
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[FeedbackProcessor] ANTHROPIC_API_KEY not set — skipping rule promotion");
    return;
  }

  // Cooldown check: when did we last analyze this correction type?
  const cooldownKey = `prompt.rule.${correctionType}.analyzed_at`;
  const lastAnalyzedEntry = await db.coachProfile.findUnique({ where: { key: cooldownKey } });
  const lastAnalyzedAt = lastAnalyzedEntry ? new Date(String(lastAnalyzedEntry.value)) : null;

  // Count corrections since last analysis (or all-time if never analyzed)
  const newCorrectionsCount = await db.parseFeedback.count({
    where: {
      correctionType,
      processed: true,
      ...(lastAnalyzedAt ? { createdAt: { gt: lastAnalyzedAt } } : {}),
    },
  });

  if (newCorrectionsCount === 0) {
    console.log(`[FeedbackProcessor] Rule promotion skipped — no new corrections since last analysis (${correctionType})`);
    return;
  }

  // Load the most recent 10 processed corrections of this type
  const corrections = await db.parseFeedback.findMany({
    where: { correctionType, processed: true },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      feedbackText: true,
      fieldsCorrected: true,
      originalValues: true,
      correctedValues: true,
      createdAt: true,
    },
  });

  if (corrections.length < 3) return;

  // Load any existing rules for this type so Claude can build on / replace them
  const existingRules = await db.coachProfile.findMany({
    where: { key: { startsWith: `prompt.rule.${correctionType}.rule_` } },
    orderBy: { key: "asc" },
  });
  const existingRuleTexts = existingRules.map((r) => String(r.value));

  const systemPrompt = `You are a prompt engineering assistant for a trading post AI parser.

You have been given a set of user corrections where the AI misinterpreted a trading coach's posts.
Your job is to synthesize 1-3 concise, actionable rules that should be added to the parser's system prompt
to prevent these mistakes from recurring.

Rules must be:
- Specific and actionable (start with an imperative: "Always", "Never", "When you see X, do Y")
- Focused on the PATTERN of errors, not individual cases
- Short enough to fit in a system prompt (max 25 words each)
- Different from any existing rules already in the prompt

Correction type being analyzed: ${correctionType}

Return ONLY valid JSON (no markdown):
{
  "rules": [
    "Rule text here (max 25 words)",
    "Another rule if warranted"
  ],
  "summary": "1-sentence description of the pattern these corrections reveal"
}

Return at most 3 rules. Return an empty array if the corrections don't reveal a clear pattern.`;

  const userMessage = `Existing rules for this correction type (do not duplicate):
${existingRuleTexts.length > 0 ? existingRuleTexts.map((r, i) => `${i + 1}. ${r}`).join("\n") : "(none yet)"}

Recent corrections (newest first):
${corrections
  .map(
    (c, i) => `[${i + 1}] Feedback: "${c.feedbackText}"
   Fields corrected: ${c.fieldsCorrected.join(", ") || "unspecified"}
   Original: ${JSON.stringify(c.originalValues)}
   Corrected to: ${JSON.stringify(c.correctedValues)}`
  )
  .join("\n\n")}

Synthesize hard rules from these correction patterns.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = response.content[0];
    if (content.type !== "text") throw new Error("Unexpected content type");

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const result = JSON.parse(jsonMatch[0]) as { rules: string[]; summary: string };

    // Delete old rules for this type and write new ones
    await db.coachProfile.deleteMany({
      where: { key: { startsWith: `prompt.rule.${correctionType}.rule_` } },
    });

    for (let i = 0; i < result.rules.length; i++) {
      const ruleKey = `prompt.rule.${correctionType}.rule_${i + 1}`;
      await updateProfile(db, ruleKey, result.rules[i], "user_corrected");
    }

    // Record the analysis timestamp and summary
    await updateProfile(db, cooldownKey, new Date().toISOString(), "system_detected");
    await updateProfile(
      db,
      `prompt.rule.${correctionType}.summary`,
      result.summary,
      "system_detected"
    );

    console.log(
      `[FeedbackProcessor] Promoted ${result.rules.length} rule(s) for "${correctionType}": ` +
        result.rules.map((r, i) => `\n  ${i + 1}. ${r}`).join("")
    );
  } catch (err) {
    console.error(`[FeedbackProcessor] Rule synthesis failed for "${correctionType}":`, err);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Safe fallback when classification cannot be performed */
function emptyClassification(): ClassifiedCorrection {
  return {
    correctionType: "missing_data",
    fieldsCorrected: [],
    correctedValues: null,
    terminologyUpdates: {},
    knowledgeUpdates: [],
  };
}

/**
 * Build a Prisma update payload from corrected values.
 * Only includes fields that are present and non-null in correctedValues.
 */
function buildTradeUpdates(
  correctedValues: Record<string, unknown>
): Record<string, unknown> {
  const allowed: (keyof typeof correctedValues)[] = [
    "ticker",
    "direction",
    "priceConfirmation",
    "priceTargetHigh",
    "priceTargetLow",
    "stopLoss",
    "supportLevel",
    "resistanceLevel",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowed) {
    if (field in correctedValues && correctedValues[field] != null) {
      updates[field] = correctedValues[field];
    }
  }
  return updates;
}
