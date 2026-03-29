/**
 * Reference Document Processor
 *
 * Processes methodology books and reference PDFs through 4 specialized
 * extraction passes, each targeting a distinct knowledge category:
 *
 *   Pass 1 — Terminology     → KnowledgeEntry (category: "term") + CoachProfile (terminology.*)
 *   Pass 2 — Patterns        → KnowledgeEntry (category: "pattern")
 *   Pass 3 — Methodology     → CoachProfile (methodology.*, principles.*, risk.*)
 *   Pass 4 — Instruments     → KnowledgeEntry (category: "instrument", "relationship")
 *
 * Uses max_tokens: 4096 per pass (vs. 1024 for thesis entries) to handle
 * the volume of structured data in a full-length reference book.
 *
 * All extracted entries use source: "reference" so they're distinguishable
 * from thesis entries (Coach's own words) and system_detected entries.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@repo/db";

// ── Return type ────────────────────────────────────────────────────────────────

export interface ProcessedReferenceDocument {
  id: string;
  title: string;
  filename: string;
  status: string;
  extractedKeys: string[];
}

// ── Internal extraction types ──────────────────────────────────────────────────

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
  summary?: string;
  profile_updates: ProfileUpdate[];
  knowledge_updates: KnowledgeUpdate[];
}

// ── The 4 specialized extraction passes ───────────────────────────────────────

const PASSES = [
  {
    label: "Terminology",
    system: `You extract trading terminology from a reference book about trading methodology.

Focus EXCLUSIVELY on:
- Abbreviations and their definitions (e.g., SOW = Sign of Weakness)
- Phase names and event names with their meanings
- Specialized terms unique to this methodology
- Any jargon the author uses that differs from general trading terms

CoachProfile keys:
  terminology.ABBR → meaning string (e.g., terminology.SOW = "Sign of Weakness — bearish distribution signal")

KnowledgeBase entries:
  category: "term"
  key: "term.ABBR"
  data: { "abbreviation": "...", "fullName": "...", "description": "...", "phase": "distribution"|"accumulation"|null, "direction": "bearish"|"bullish"|"neutral" }

Return ONLY valid JSON:
{
  "profile_updates": [ { "key": "terminology.ABBR", "value": "...", "confidence": 0.95 } ],
  "knowledge_updates": [ { "category": "term", "key": "term.ABBR", "data": { ... } } ]
}

If no terminology found, return empty arrays for both.`,
  },
  {
    label: "Patterns & Schematics",
    system: `You extract chart patterns and market structure schematics from a reference book about trading methodology.

Focus EXCLUSIVELY on:
- Named chart formations and their visual characteristics
- Market structure phases with identifiable events
- How to identify each pattern on a real chart
- The directional implication of each pattern
- Key sequence of events within each pattern

KnowledgeBase entries:
  category: "pattern"
  key: "pattern.snake_case_name"
  data: {
    "name": "...",
    "direction": "bullish"|"bearish"|"neutral",
    "description": "...",
    "keyEvents": ["..."],
    "identificationCues": ["..."],
    "volumeCharacteristics": "...",
    "reliability": 0.0-1.0
  }

Return ONLY valid JSON:
{
  "profile_updates": [],
  "knowledge_updates": [ { "category": "pattern", "key": "pattern.NAME", "data": { ... } } ]
}

If no patterns described, return empty arrays.`,
  },
  {
    label: "Methodology & Principles",
    system: `You extract the core trading methodology, decision rules, and risk principles from a reference book.

Focus EXCLUSIVELY on:
- The primary trading framework or methodology name
- Step-by-step decision rules for entries, exits, and confirmations
- Risk management rules (stop placement, position sizing, max loss)
- Named principles or laws the author explicitly states
- How the author analyzes market phases and determines timing

CoachProfile keys:
  methodology.primary    → framework name (lowercase, e.g. "wyckoff")
  methodology.notes      → detailed description of the approach
  risk.stop_loss_philosophy → text
  risk.position_sizing   → text
  principles.RULE_NAME   → text description of a named rule or law

KnowledgeBase entries:
  category: "principle"
  key: "principle.snake_case_name"
  data: { "rule": "...", "context": "...", "application": "..." }

Return ONLY valid JSON:
{
  "profile_updates": [ { "key": "methodology.primary", "value": "...", "confidence": 0.95 } ],
  "knowledge_updates": [ { "category": "principle", "key": "principle.NAME", "data": { ... } } ]
}

If no methodology structure described, return empty arrays.`,
  },
  {
    label: "Instruments & Relationships",
    system: `You extract information about financial instruments, securities, and their relationships from a reference book about trading methodology.

Focus EXCLUSIVELY on:
- Named securities, ETFs, indices, and futures discussed by the author
- Inverse or leveraged ETF relationships (e.g., SOX up → SOXS down)
- Sector-to-instrument mappings
- Which instruments the author uses to express specific directional views
- Correlation relationships between instruments

KnowledgeBase entries:
  category: "instrument"
  key: "instrument.TICKER"
  data: { "ticker": "...", "name": "...", "type": "etf"|"index"|"stock"|"futures", "sector": "...", "direction": "3x_bear"|"3x_bull"|"inverse"|"1x"|null }

  category: "relationship"
  key: "relationship.TICKER1_TICKER2"
  data: { "instrument1": "...", "instrument2": "...", "relationship": "inverse"|"correlated"|"sector_proxy"|"leveraged", "notes": "..." }

Return ONLY valid JSON:
{
  "profile_updates": [],
  "knowledge_updates": [
    { "category": "instrument", "key": "instrument.TICKER", "data": { ... } },
    { "category": "relationship", "key": "relationship.A_B", "data": { ... } }
  ]
}

If no instrument information found, return empty arrays.`,
  },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseExtraction(text: string): ExtractionResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as ExtractionResult;
  } catch {
    // fall through
  }
  return { profile_updates: [], knowledge_updates: [] };
}

async function applyReferenceExtraction(
  db: PrismaClient,
  extracted: ExtractionResult
): Promise<string[]> {
  const extractedKeys: string[] = [];

  for (const update of extracted.profile_updates ?? []) {
    if (!update.key || update.value === undefined) continue;
    await db.coachProfile.upsert({
      where: { key: update.key },
      update: {
        value: update.value as Parameters<typeof db.coachProfile.upsert>[0]["update"]["value"],
        source: "reference",
        confidence: update.confidence ?? 0.85,
      },
      create: {
        key: update.key,
        value: update.value as Parameters<typeof db.coachProfile.upsert>[0]["create"]["value"],
        source: "reference",
        confidence: update.confidence ?? 0.85,
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
        source: "reference",
        validated: true,
      },
      create: {
        category: kb.category,
        key: kb.key,
        data: kb.data as Parameters<typeof db.knowledgeEntry.upsert>[0]["create"]["data"],
        source: "reference",
        validated: true,
      },
    });
    extractedKeys.push(`kb:${kb.key}`);
  }

  return extractedKeys;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Process a reference PDF through 4 specialized extraction passes.
 * Each pass targets a distinct knowledge category and writes to
 * CoachProfile / KnowledgeEntry with source: "reference".
 *
 * @param onProgress - Optional callback fired after each pass with
 *                     (completedPasses: 1-4, totalPasses: 4).
 *                     Use for streaming progress updates in future SSE endpoint.
 */
export async function processReferenceDocument(
  db: PrismaClient,
  pdfBase64: string,
  filename: string,
  title?: string,
  onProgress?: (completed: number, total: number) => void
): Promise<ProcessedReferenceDocument> {
  const resolvedTitle = title?.trim() || filename;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Create the DB record immediately so the UI can show it in "processing" state
  const doc = await db.referenceDocument.create({
    data: {
      title: resolvedTitle,
      filename,
      status: "processing",
      extractedKeys: [],
    },
  });

  const allExtractedKeys: string[] = [];

  try {
    for (let i = 0; i < PASSES.length; i++) {
      const pass = PASSES[i];

      let extracted: ExtractionResult = { profile_updates: [], knowledge_updates: [] };

      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: pass.system,
          messages: [
            {
              role: "user",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: pdfBase64,
                  },
                } as any,
                {
                  type: "text",
                  text: `Extract ${pass.label.toLowerCase()} from this reference document.\nFilename: ${filename}`,
                },
              ],
            },
          ],
        });

        const content = response.content[0];
        if (content.type === "text") {
          extracted = parseExtraction(content.text);
        }
      } catch (err) {
        console.warn(`[ReferenceProcessor] Pass ${i + 1} (${pass.label}) failed:`, err);
        // Continue to next pass — partial extraction is better than none
      }

      const passKeys = await applyReferenceExtraction(db, extracted);
      allExtractedKeys.push(...passKeys);

      // Persist progress incrementally so partial results survive a crash
      await db.referenceDocument.update({
        where: { id: doc.id },
        data: { extractedKeys: allExtractedKeys },
      });

      onProgress?.(i + 1, PASSES.length);
    }

    await db.referenceDocument.update({
      where: { id: doc.id },
      data: { status: "complete", extractedKeys: allExtractedKeys },
    });
  } catch (err) {
    console.error("[ReferenceProcessor] Fatal error:", err);
    await db.referenceDocument.update({
      where: { id: doc.id },
      data: { status: "error", extractedKeys: allExtractedKeys },
    });
  }

  return {
    id: doc.id,
    title: resolvedTitle,
    filename,
    status: allExtractedKeys.length > 0 ? "complete" : "error",
    extractedKeys: allExtractedKeys,
  };
}
