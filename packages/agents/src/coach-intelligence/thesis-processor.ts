/**
 * Thesis Processor
 *
 * Processes Coach's thesis entries — documented views on macro environment,
 * methodology, instruments, bias, etc. Each entry is extracted by Claude into
 * structured CoachProfile and KnowledgeBase updates, then stored as a ThesisEntry
 * with timestamp so the context builder can inject recency-aware context.
 *
 * Thesis entries are the highest-confidence signal: Coach wrote them intentionally
 * to explain their worldview, not as a reactive post. They take precedence over
 * system_detected profile entries.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@repo/db";

// ── Topic definitions ──────────────────────────────────────────────────────────

export const THESIS_TOPICS = [
  { key: "market",             label: "Market",             color: "var(--semantic-warning)" },
  { key: "trading_principles", label: "Trading Principles", color: "var(--accent-primary)" },
] as const;

export type ThesisTopic = typeof THESIS_TOPICS[number]["key"];

// ── Extraction types ───────────────────────────────────────────────────────────

interface ProfileUpdate {
  key: string;
  value: unknown;
  confidence: number;
}

interface KnowledgeUpdate {
  category: string;
  key: string;
  data: Record<string, unknown>;
}

interface ExtractionResult {
  summary: string;
  profile_updates: ProfileUpdate[];
  knowledge_updates: KnowledgeUpdate[];
}

export interface ProcessedThesisEntry {
  id: string;
  topic: ThesisTopic;
  title: string | null;
  summary: string;
  extractedKeys: string[];
  postDate: Date | null;
  createdAt: Date;
}

// ── Extraction prompt ──────────────────────────────────────────────────────────

function buildExtractionPrompt(topicLabel: string): string {
  return `You extract structured trading intelligence from a professional coach's documented views.

The coach is a day trader who primarily uses Wyckoff methodology, focuses on bearish/distribution setups, and frequently uses inverse ETFs (SOXS, SQQQ) for short positioning.

Topic category: "${topicLabel}"
- "Market" covers: macro conditions, current directional bias, sector analysis, key price levels, market drivers
- "Trading Principles" covers: methodology, decision-making rules, risk management, instruments used, terminology, how the coach thinks about and executes trades

Extract:
1. A single crisp sentence summarizing the core insight
2. CoachProfile key-value updates — structured facts about the coach's style/approach
3. KnowledgeBase entries — reusable knowledge about patterns, instruments, or terminology

CoachProfile key conventions:
  bias.current           → "bullish" | "bearish" | "neutral"
  bias.reasoning         → string (why the coach holds this bias)
  bias.preferredInstruments → array of strings
  macro.overview         → general macro conditions description
  macro.sector.NAME      → sector-specific analysis (e.g., macro.sector.semiconductors)
  macro.drivers          → array of key macro drivers the coach is watching
  methodology.primary    → "wyckoff" | "technical" | etc.
  methodology.notes      → additional methodology detail
  risk.stop_loss_philosophy → text describing stop loss approach
  risk.position_sizing   → text describing position sizing rules
  principles.RULE        → a named trading principle or decision rule (e.g., principles.entry_trigger)
  terminology.ABBR       → meaning of an abbreviation (e.g., terminology.SOW = "Sign of Weakness")

KnowledgeBase categories: "pattern" | "instrument" | "term" | "relationship" | "chart_element" | "principle"

Return ONLY valid JSON:
{
  "summary": "One crisp sentence",
  "profile_updates": [
    { "key": "bias.current", "value": "bearish", "confidence": 0.95 }
  ],
  "knowledge_updates": [
    { "category": "instrument", "key": "instrument.SOXS", "data": { "ticker": "SOXS", "name": "Direxion Semiconductor Bear 3x", "relationship": "inverse of SOX" } }
  ]
}

If the text doesn't contain extractable structured data for a section, return an empty array for that section.`;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

/** Parse the JSON blob from Claude's response text. */
function parseExtraction(text: string, fallbackSummary: string): ExtractionResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as ExtractionResult;
  } catch {
    // fall through
  }
  return { summary: fallbackSummary, profile_updates: [], knowledge_updates: [] };
}

/** Apply extracted updates to the DB and return the list of affected keys. */
async function applyExtraction(db: PrismaClient, extracted: ExtractionResult): Promise<string[]> {
  const extractedKeys: string[] = [];

  for (const update of extracted.profile_updates ?? []) {
    if (!update.key || update.value === undefined) continue;
    await db.coachProfile.upsert({
      where: { key: update.key },
      update: {
        value: update.value as Parameters<typeof db.coachProfile.upsert>[0]["update"]["value"],
        source: "thesis",
        confidence: update.confidence ?? 0.9,
      },
      create: {
        key: update.key,
        value: update.value as Parameters<typeof db.coachProfile.upsert>[0]["create"]["value"],
        source: "thesis",
        confidence: update.confidence ?? 0.9,
        observationCount: 1,
      },
    });
    extractedKeys.push(`profile:${update.key}`);
  }

  for (const kb of extracted.knowledge_updates ?? []) {
    if (!kb.key || !kb.category || !kb.data) continue;
    await db.knowledgeEntry.upsert({
      where: { key: kb.key },
      update: {
        data: kb.data as Parameters<typeof db.knowledgeEntry.upsert>[0]["update"]["data"],
        source: "thesis",
        validated: true,
      },
      create: {
        category: kb.category,
        key: kb.key,
        data: kb.data as Parameters<typeof db.knowledgeEntry.upsert>[0]["create"]["data"],
        source: "thesis",
        validated: true,
      },
    });
    extractedKeys.push(`kb:${kb.key}`);
  }

  return extractedKeys;
}

// ── Text processor ─────────────────────────────────────────────────────────────

/**
 * Process a new thesis entry from pasted/typed text or a pre-parsed CSV/TXT string.
 */
export async function processThesisEntry(
  db: PrismaClient,
  topic: ThesisTopic,
  rawText: string,
  title?: string,
  postDate?: Date
): Promise<ProcessedThesisEntry> {
  const topicLabel = THESIS_TOPICS.find((t) => t.key === topic)?.label ?? topic;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let extracted: ExtractionResult = {
    summary: rawText.slice(0, 120).trim() + (rawText.length > 120 ? "…" : ""),
    profile_updates: [],
    knowledge_updates: [],
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildExtractionPrompt(topicLabel),
      messages: [{ role: "user", content: `Topic: ${topicLabel}\n\nText:\n${rawText}` }],
    });
    const content = response.content[0];
    if (content.type === "text") {
      extracted = parseExtraction(content.text, extracted.summary);
    }
  } catch (err) {
    console.warn("[ThesisProcessor] Claude extraction failed, saving raw entry:", err);
  }

  const extractedKeys = await applyExtraction(db, extracted);

  const entry = await db.thesisEntry.create({
    data: {
      topic,
      title: title?.trim() || null,
      rawText,
      summary: extracted.summary,
      extractedKeys,
      postDate: postDate ?? null,
    },
  });

  return {
    id: entry.id,
    topic: entry.topic as ThesisTopic,
    title: entry.title,
    summary: entry.summary,
    extractedKeys: entry.extractedKeys as string[],
    postDate: entry.postDate,
    createdAt: entry.createdAt,
  };
}

// ── PDF processor ──────────────────────────────────────────────────────────────

/**
 * Process a thesis entry from a PDF file.
 * Sends the PDF to Claude as a native document content block — no client-side text extraction.
 */
export async function processThesisEntryFromPdf(
  db: PrismaClient,
  topic: ThesisTopic,
  pdfBase64: string,
  filename: string,
  title?: string,
  postDate?: Date
): Promise<ProcessedThesisEntry> {
  const topicLabel = THESIS_TOPICS.find((t) => t.key === topic)?.label ?? topic;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const fallbackSummary = `PDF: ${filename}`;
  let extracted: ExtractionResult = {
    summary: fallbackSummary,
    profile_updates: [],
    knowledge_updates: [],
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: buildExtractionPrompt(topicLabel),
      messages: [
        {
          role: "user",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            } as any,
            {
              type: "text",
              text: `Topic: ${topicLabel}\n\nExtract structured trading intelligence from this PDF document.`,
            },
          ],
        },
      ],
    });
    const content = response.content[0];
    if (content.type === "text") {
      extracted = parseExtraction(content.text, fallbackSummary);
    }
  } catch (err) {
    console.warn("[ThesisProcessor] Claude PDF extraction failed, saving entry:", err);
  }

  const extractedKeys = await applyExtraction(db, extracted);

  const entry = await db.thesisEntry.create({
    data: {
      topic,
      title: title?.trim() || filename,
      rawText: `[PDF: ${filename}]`,
      summary: extracted.summary,
      extractedKeys,
      postDate: postDate ?? null,
    },
  });

  return {
    id: entry.id,
    topic: entry.topic as ThesisTopic,
    title: entry.title,
    summary: entry.summary,
    extractedKeys: entry.extractedKeys as string[],
    postDate: entry.postDate,
    createdAt: entry.createdAt,
  };
}

// ── Context builder ─────────────────────────────────────────────────────────────

/**
 * Get thesis entries for context injection — most recent entry per topic.
 * Returns entries sorted newest-first, deduplicated to one per topic.
 */
export async function getThesisContext(
  db: PrismaClient
): Promise<Array<{ topic: string; topicLabel: string; summary: string; createdAt: Date }>> {
  const entries = await db.thesisEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Deduplicate to most recent per topic
  const seen = new Set<string>();
  const result: Array<{ topic: string; topicLabel: string; summary: string; createdAt: Date }> = [];

  for (const entry of entries) {
    if (!seen.has(entry.topic)) {
      seen.add(entry.topic);
      const topicLabel = THESIS_TOPICS.find((t) => t.key === entry.topic)?.label ?? entry.topic;
      result.push({
        topic: entry.topic,
        topicLabel,
        summary: entry.summary,
        createdAt: entry.createdAt,
      });
    }
  }

  return result;
}
