/**
 * Coach Intelligence Agent
 *
 * Makes the parser smarter over time by maintaining structured knowledge
 * about Coach's trading style, terminology, chart patterns, and historical accuracy.
 *
 * Sits between post ingestion and trade parsing — every parse call should:
 * 1. Call buildParseContext(db) and prepend to the Claude text parse system prompt
 * 2. Call getCoachVisionPrompt(db) instead of the generic Vision prompt for images
 * 3. Call getInverseRelationships(db, ticker) after Vision to auto-suggest inverse ETF trades
 * 4. Call processFeedback(db, feedbackId) when a user submits a Report correction
 *
 * All functions accept a PrismaClient instance — callers provide the db connection.
 * This allows reuse in both Next.js API routes (using apps/web/lib/db.ts) and
 * standalone worker processes (which create their own PrismaClient instance).
 *
 * @module coach-intelligence
 */

// Coach Profile — style, terminology, bias
export {
  loadProfile,
  updateProfile,
  getTerminology,
  getBias,
  getChartStyle,
} from "./coach-profile";

export type { CoachProfileData } from "./coach-profile";

// Knowledge Base — patterns, instruments, terms, relationships
export {
  search,
  getByKey,
  getByCategory,
  getInverseRelationships,
  addEntry,
  validateEntry,
} from "./knowledge-base";

export type { KnowledgeEntryData, InverseRelationship } from "./knowledge-base";

// Context Builder — assembles Coach decoder ring for Claude prompts
export { buildParseContext, buildVisionContext, buildSeriesContext } from "./context-builder";

// Feedback Processor — classify corrections, update records, route to Profile/KB
export {
  processFeedback,
  classifyCorrection,
  analyzeAndPromoteCorrections,
} from "./feedback-processor";

export type { CorrectionType, ClassifiedCorrection } from "./feedback-processor";

// Vision Prompt — Coach-specific Claude Vision prompt
export { getCoachVisionPrompt, getGenericVisionPrompt } from "./vision-prompt";

// Thesis Processor — evolving documented worldview, multi-topic thesis feed
export {
  processThesisEntry,
  processThesisEntryFromPdf,
  getThesisContext,
  THESIS_TOPICS,
} from "./thesis-processor";

export type { ThesisTopic, ProcessedThesisEntry } from "./thesis-processor";

// Reference Document Processor — 4-pass extraction from methodology PDFs
export { processReferenceDocument } from "./reference-processor";
export type { ProcessedReferenceDocument } from "./reference-processor";

// Bootstrap Seed — populate CoachProfile + KnowledgeEntry tables
export { seedCoachIntelligence } from "./seed";
