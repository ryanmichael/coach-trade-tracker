/**
 * Knowledge Base module
 * Manages the KnowledgeEntry table — a curated store of trading patterns,
 * instruments, Wyckoff terminology, chart elements, and instrument relationships.
 * Seeded at bootstrap with 50+ entries; grows via system detection and user corrections.
 */

import type { PrismaClient } from "@/generated/prisma";

/** Shape of a KnowledgeEntry row */
export interface KnowledgeEntryData {
  id: string;
  category: string;
  key: string;
  data: unknown;
  source: string;
  validated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Resolved inverse relationship between two instruments */
export interface InverseRelationship {
  ticker: string;
  inverseTicker: string;
  description: string;
  coachNote?: string;
}

/**
 * Full-text search across KnowledgeEntry records.
 * Searches key and category fields (case-insensitive).
 * Returns validated entries first, then sorted by recency.
 */
export async function search(
  db: PrismaClient,
  query: string
): Promise<KnowledgeEntryData[]> {
  if (!query.trim()) return [];

  return db.knowledgeEntry.findMany({
    where: {
      OR: [
        { key: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ validated: "desc" }, { updatedAt: "desc" }],
  });
}

/**
 * Exact key lookup.
 * Returns null if the entry does not exist.
 */
export async function getByKey(
  db: PrismaClient,
  key: string
): Promise<KnowledgeEntryData | null> {
  return db.knowledgeEntry.findUnique({ where: { key } });
}

/**
 * List all entries in a specific category.
 * Categories: pattern, instrument, term, chart_element, relationship
 */
export async function getByCategory(
  db: PrismaClient,
  category: string
): Promise<KnowledgeEntryData[]> {
  return db.knowledgeEntry.findMany({
    where: { category },
    orderBy: { key: "asc" },
  });
}

/**
 * Find inverse or correlated instruments for a given ticker.
 *
 * Checks relationship entries where asset_a or asset_b matches the ticker,
 * and checks instrument entries for inline inverse_ticker / inverse_of fields.
 *
 * Used to auto-suggest secondary ParsedTrade records — e.g., if Coach's chart
 * shows a bearish SOX setup, suggest a SOXS long as a secondary trade.
 */
export async function getInverseRelationships(
  db: PrismaClient,
  ticker: string
): Promise<InverseRelationship[]> {
  const [relationships, instrumentEntry] = await Promise.all([
    db.knowledgeEntry.findMany({ where: { category: "relationship" } }),
    db.knowledgeEntry.findUnique({ where: { key: ticker } }),
  ]);

  const results: InverseRelationship[] = [];
  const seen = new Set<string>();

  // Check relationship entries
  for (const entry of relationships) {
    const data = entry.data as Record<string, unknown>;
    if (data.type !== "inverse") continue;

    const assetA = String(data.asset_a ?? "");
    const assetB = String(data.asset_b ?? "");

    if (assetA === ticker && !seen.has(assetB)) {
      seen.add(assetB);
      results.push({
        ticker,
        inverseTicker: assetB,
        description: String(data.description ?? ""),
        coachNote: data.coach_note ? String(data.coach_note) : undefined,
      });
    } else if (assetB === ticker && !seen.has(assetA)) {
      seen.add(assetA);
      results.push({
        ticker,
        inverseTicker: assetA,
        description: String(data.description ?? ""),
        coachNote: data.coach_note ? String(data.coach_note) : undefined,
      });
    }
  }

  // Check instrument entry for inline inverse_ticker / inverse_of fields
  if (instrumentEntry) {
    const data = instrumentEntry.data as Record<string, unknown>;

    if (data.inverse_ticker) {
      const inv = String(data.inverse_ticker);
      if (!seen.has(inv)) {
        seen.add(inv);
        results.push({
          ticker,
          inverseTicker: inv,
          description: `${inv} is the inverse ETF for ${ticker}`,
        });
      }
    }

    if (data.inverse_of) {
      const inv = String(data.inverse_of);
      if (!seen.has(inv)) {
        seen.add(inv);
        results.push({
          ticker,
          inverseTicker: inv,
          description: `${ticker} is the inverse ETF of ${inv}`,
        });
      }
    }
  }

  return results;
}

/**
 * Add or update a Knowledge Base entry.
 * Upserts by key — safe to call multiple times with the same key.
 */
export async function addEntry(
  db: PrismaClient,
  category: string,
  key: string,
  data: unknown,
  source: "seed" | "system_detected" | "user_added" = "user_added"
): Promise<KnowledgeEntryData> {
  return db.knowledgeEntry.upsert({
    where: { key },
    create: {
      category,
      key,
      data: data as any,
      source,
      // User-added entries start as validated; system-detected need review
      validated: source === "user_added",
    },
    update: {
      data: data as any,
      source,
    },
  });
}

/**
 * Mark a Knowledge Base entry as validated by a human reviewer.
 * Validated entries take precedence in search results.
 */
export async function validateEntry(db: PrismaClient, key: string): Promise<void> {
  await db.knowledgeEntry.update({
    where: { key },
    data: { validated: true },
  });
}
