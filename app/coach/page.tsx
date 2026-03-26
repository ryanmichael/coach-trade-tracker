"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { THESIS_TOPICS } from "@repo/agents";
import type { ThesisTopic } from "@repo/agents";
import { ActionPanel } from "@/components/layout/ActionPanel";
import { CollapsibleSection } from "@/components/quick-paste/CollapsibleSection";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ThesisEntry {
  id: string;
  topic: ThesisTopic;
  title: string | null;
  rawText: string;
  summary: string;
  extractedKeys: string[];
  postDate: string | null;
  createdAt: string;
}

interface ReferenceDoc {
  id: string;
  title: string;
  filename: string;
  status: "processing" | "complete" | "error";
  extractedKeys: string[];
  createdAt: string;
}

interface ProfileEntry {
  id: string;
  key: string;
  value: unknown;
  source: string;
  confidence: number;
  lastUpdated: string;
}

// ── CSV parser ─────────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into rows of fields.
 * Handles quoted fields that contain commas, newlines, and escaped double-quotes.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); field = ""; rows.push(row); row = []; }
      else if (ch !== '\r') { field += ch; }
    }
    i++;
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Convert a scraped-tweets CSV into clean text for Claude + display.
 * Treats the entire CSV as ONE X post — a single batch of content with one date.
 * Keeps Tweet Content + Tweet Creation Date; strips all engagement metadata.
 *
 * - `text`        — all tweet content joined, no date header (sent to Claude)
 * - `displayText` — same content with a single date header at the top
 * - `rowCount`    — always 1 (the CSV = one thesis entry)
 * - `postDate`    — most recent tweet date in the batch (stored on the entry)
 */
function csvToThesisText(raw: string): {
  text: string;
  displayText: string;
  rowCount: number;
  postDate: Date | null;
} {
  const rows = parseCsvRows(raw);
  if (rows.length < 2) return { text: raw, displayText: raw, rowCount: 0, postDate: null };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const contentIdx = headers.findIndex((h) => h.includes("tweet content") || h === "content");
  const dateIdx = headers.findIndex((h) => h.includes("tweet creation") || h.includes("creation date"));

  if (contentIdx === -1) return { text: raw, displayText: raw, rowCount: 0, postDate: null };

  const dataRows = rows.slice(1).filter((r) => r[contentIdx]?.trim());
  if (dataRows.length === 0) return { text: "", displayText: "", rowCount: 0, postDate: null };

  const dates: Date[] = [];
  const contentLines: string[] = [];

  for (const r of dataRows) {
    const content = r[contentIdx].trim();
    if (content) contentLines.push(content);

    if (dateIdx !== -1) {
      const iso = r[dateIdx]?.trim();
      if (iso) {
        try { dates.push(new Date(iso)); } catch { /* skip bad dates */ }
      }
    }
  }

  const postDate = dates.length > 0
    ? new Date(Math.max(...dates.map((d) => d.getTime())))
    : null;

  // Join all content as one unified post — no per-row separators
  const text = contentLines.join("\n\n");

  // Display version: single date label at the top
  const dateLabel = postDate
    ? postDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const displayText = dateLabel ? `[${dateLabel}]\n\n${text}` : text;

  return { text, displayText, rowCount: 1, postDate };
}

// ── Topic helpers ──────────────────────────────────────────────────────────────

function getTopicConfig(key: string) {
  return THESIS_TOPICS.find((t) => t.key === key) ?? { key, label: key, color: "var(--text-tertiary)" };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Group profile entries by their top-level key prefix
function groupProfileEntries(entries: ProfileEntry[]) {
  const groups: Record<string, ProfileEntry[]> = {};
  for (const entry of entries) {
    const prefix = entry.key.split(".")[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(entry);
  }
  return groups;
}

function sourceLabel(source: string) {
  switch (source) {
    case "thesis":        return "thesis";
    case "reference":     return "reference";
    case "user_corrected": return "correction";
    case "system_detected": return "detected";
    case "manual":        return "manual";
    default:              return source;
  }
}

function sourceColor(source: string) {
  switch (source) {
    case "thesis":        return "var(--accent-primary)";
    case "reference":     return "var(--semantic-info)";
    case "user_corrected": return "var(--semantic-positive)";
    case "system_detected": return "var(--text-tertiary)";
    default:              return "var(--text-tertiary)";
  }
}

// ── Add Entry panel ────────────────────────────────────────────────────────────

interface AddEntryPanelProps {
  onClose: () => void;
  onSaved: (entry: ThesisEntry) => void;
}

type FileMode = "text" | "pdf" | "csv";

interface AttachedFile {
  name: string;
  mode: "pdf" | "csv";
  pdfBase64?: string;    // for PDF — sent directly to Claude
  csvText?: string;      // for CSV — clean content (sent to Claude, no date headers)
  csvDisplayText?: string; // for CSV — content with [Date] headers (shown in textarea)
  rowCount?: number;     // for CSV — number of posts extracted
  postDate?: Date | null; // for CSV — most recent tweet date
}

function AddEntryPanel({ onClose, onSaved }: AddEntryPanelProps) {
  const [topic, setTopic] = useState<ThesisTopic>("market");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState<AttachedFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mode: FileMode = attached?.mode === "pdf" ? "pdf" : "text";
  const canSubmit = !submitting && (mode === "pdf" ? !!attached?.pdfBase64 : rawText.trim().length > 0);

  const processFile = (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        // Strip the "data:application/pdf;base64," prefix
        const base64 = dataUrl.split(",")[1];
        setAttached({ name: file.name, mode: "pdf", pdfBase64: base64 });
      };
      reader.readAsDataURL(file);
    } else if (isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const raw = e.target?.result as string;
        const { text, displayText, rowCount, postDate } = csvToThesisText(raw);
        setRawText(displayText); // show with date headers in textarea
        setAttached({ name: file.name, mode: "csv", csvText: text, csvDisplayText: displayText, rowCount, postDate });
      };
      reader.readAsText(file);
    } else {
      setError("Only PDF and CSV files are supported.");
    }
  };

  const clearFile = () => {
    setAttached(null);
    if (attached?.mode === "csv") setRawText("");
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const postDate = attached?.postDate?.toISOString();
      const body =
        mode === "pdf"
          ? { topic, pdfBase64: attached!.pdfBase64, filename: attached!.name, postDate }
          : {
              topic,
              rawText: (attached?.csvText ?? rawText).trim(),
              postDate,
            };

      const res = await fetch("/api/coach/thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      const entry = await res.json();
      onSaved(entry);
      onClose();
    } catch {
      setError("Failed to process entry. Check your Anthropic API key.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
      }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--bg-overlay)",
          animation: "fadeIn 200ms ease",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          width: 440,
          maxWidth: "100vw",
          height: "100%",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 350ms cubic-bezier(0, 0, 0.2, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
              Add Thesis Entry
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              Paste text or upload a PDF / CSV file
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-tertiary)",
              cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Topic picker */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              Topic
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {THESIS_TOPICS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTopic(t.key)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "var(--radius-brand-sm)",
                    border: `1px solid ${topic === t.key ? t.color : "var(--border-default)"}`,
                    background: topic === t.key ? `${t.color}18` : "transparent",
                    color: topic === t.key ? t.color : "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    transition: "all 120ms ease",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* File drop zone */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              File <span style={{ color: "var(--text-tertiary)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(PDF or CSV — optional)</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,application/pdf,text/csv"
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
            {attached ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  background: "var(--bg-base)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-brand-md)",
                }}
              >
                <span style={{ fontSize: 16 }}>{attached.mode === "pdf" ? "📄" : "📊"}</span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {attached.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: attached.mode === "pdf" ? "var(--accent-primary)" : "var(--semantic-positive)",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-brand-sm)",
                    border: `1px solid ${attached.mode === "pdf" ? "var(--accent-primary)30" : "var(--semantic-positive)30"}`,
                    background: attached.mode === "pdf" ? "var(--accent-muted)" : "var(--semantic-positive-muted)",
                  }}
                >
                  {attached.mode === "pdf" ? "PDF → Claude" : "CSV → 1 entry"}
                </span>
                <button
                  onClick={clearFile}
                  style={{
                    background: "none", border: "none", color: "var(--text-tertiary)",
                    cursor: "pointer", fontSize: 14, padding: 2, lineHeight: 1, flexShrink: 0,
                  }}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                className={`qp-dropzone${dragging ? " active" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  Drop PDF or CSV, or{" "}
                  <span style={{ color: "var(--accent-primary)" }}>browse</span>
                </div>
              </div>
            )}
          </div>

          {/* PDF mode note */}
          {mode === "pdf" && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--accent-muted)",
                borderRadius: "var(--radius-brand-md)",
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              The PDF will be sent to Claude as a native document — no text extraction needed.
              Claude will read the full document and extract structured knowledge directly.
            </div>
          )}

          {/* Coach's Text — collapsible, closed by default */}
          {mode !== "pdf" && (
            <CollapsibleSection
              label={attached?.mode === "csv" ? "Review CSV Content" : "Coach's Text"}
              open={textOpen}
              onToggle={() => setTextOpen((v) => !v)}
            >
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={
                  attached?.mode === "csv"
                    ? "CSV content loaded — review and edit if needed before submitting."
                    : "Paste Coach's post, thread, or methodology explanation here. Can be multiple paragraphs."
                }
                style={{
                  width: "100%",
                  minHeight: attached?.mode === "csv" ? 160 : 220,
                  resize: "vertical",
                  background: "var(--bg-input)",
                  border: `1px solid ${attached?.mode === "csv" ? "var(--semantic-positive)40" : "var(--border-strong)"}`,
                  borderRadius: "var(--radius-brand-md)",
                  padding: "10px 12px",
                  fontFamily: attached?.mode === "csv" ? "'DM Mono', monospace" : "'DM Sans', system-ui, sans-serif",
                  fontSize: 12,
                  color: "var(--text-primary)",
                  lineHeight: 1.6,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = attached?.mode === "csv" ? "var(--semantic-positive)40" : "var(--border-strong)")}
              />
              {!attached && (
                <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6, lineHeight: 1.5 }}>
                  Claude will extract structured knowledge and inject it into every future parse.
                </p>
              )}
            </CollapsibleSection>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "var(--semantic-negative)", padding: "8px 12px", background: "var(--semantic-negative-muted)", borderRadius: "var(--radius-brand-sm)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "9px 16px", borderRadius: "var(--radius-brand-md)",
              border: "1px solid var(--border-strong)", background: "transparent",
              color: "var(--text-primary)", fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              flex: 2, padding: "9px 16px", borderRadius: "var(--radius-brand-md)",
              border: "none",
              background: canSubmit ? "var(--accent-primary)" : "var(--bg-elevated)",
              color: canSubmit ? "var(--text-inverse)" : "var(--text-tertiary)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13, fontWeight: 500,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {submitting ? "Extracting…" : "Save & Extract"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}

// ── Thesis View Panel ──────────────────────────────────────────────────────────

function ThesisViewPanel({ entry, onClose, onDelete }: { entry: ThesisEntry; onClose: () => void; onDelete: () => void }) {
  const cfg = getTopicConfig(entry.topic);
  const displayDate = entry.postDate ?? entry.createdAt;

  return (
    <ActionPanel
      isOpen
      onClose={onClose}
      title={cfg.label}
      description={`${formatDate(displayDate)} · ${formatTime(displayDate)}`}
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onDelete}
            style={{
              padding: "9px 16px",
              borderRadius: "var(--radius-brand-md)",
              border: "1px solid var(--semantic-negative)",
              background: "transparent",
              color: "var(--semantic-negative)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--semantic-negative-muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Delete
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "9px 16px",
              borderRadius: "var(--radius-brand-md)",
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--text-primary)",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Close
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Topic badge */}
        <span style={{
          alignSelf: "flex-start",
          fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em",
          color: cfg.color, padding: "2px 7px",
          borderRadius: "var(--radius-brand-sm)",
          border: `1px solid ${cfg.color}30`,
          background: `${cfg.color}10`,
        }}>
          {cfg.label}
        </span>

        {/* Summary */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: 6 }}>Summary</div>
          <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>{entry.summary}</div>
        </div>

        {/* Extracted keys */}
        {entry.extractedKeys.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {entry.extractedKeys.length} field{entry.extractedKeys.length !== 1 ? "s" : ""} extracted
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {entry.extractedKeys.map((k) => (
                <span key={k} style={{
                  fontSize: 11, padding: "2px 7px",
                  borderRadius: "var(--radius-brand-sm)",
                  background: "var(--semantic-positive-muted)",
                  color: "var(--semantic-positive)",
                  fontFamily: "'DM Mono', monospace",
                }}>
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Raw text */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: 6 }}>Original Text</div>
          <div style={{
            padding: "12px",
            background: "var(--bg-base)",
            borderRadius: "var(--radius-brand-md)",
            border: "1px solid var(--border-subtle)",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}>
            {entry.rawText}
          </div>
        </div>
      </div>
    </ActionPanel>
  );
}

// ── Thesis Delete Panel ─────────────────────────────────────────────────────────

function ThesisDeletePanel({ entry, onConfirm, onCancel, deleting }: { entry: ThesisEntry; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  const cfg = getTopicConfig(entry.topic);

  return (
    <ActionPanel
      isOpen
      onClose={onCancel}
      title="Delete Entry"
      description="This action cannot be undone"
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "9px 16px", borderRadius: "var(--radius-brand-md)",
              border: "1px solid var(--border-strong)", background: "transparent",
              color: "var(--text-primary)", fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex: 2, padding: "9px 16px", borderRadius: "var(--radius-brand-md)",
              border: "none", background: "var(--semantic-negative)",
              color: "#fff", fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 13, fontWeight: 500,
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.6 : 1,
              transition: "opacity var(--duration-fast) var(--ease-default)",
            }}
            onMouseEnter={(e) => { if (!deleting) e.currentTarget.style.opacity = "0.85"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = deleting ? "0.6" : "1"; }}
          >
            {deleting ? "Deleting…" : "Delete Entry"}
          </button>
        </div>
      }
    >
      <div style={{
        padding: "12px 16px",
        borderRadius: "var(--radius-brand-md)",
        background: "var(--semantic-negative-muted)",
        border: "1px solid var(--semantic-negative)",
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--semantic-negative)", marginBottom: 4 }}>
          This action cannot be undone
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          The <strong style={{ color: cfg.color }}>{cfg.label}</strong> entry will be removed from the thesis feed.
          Knowledge already extracted to the Coach Profile will not be reverted.
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
        You can re-add this entry at any time by pasting the content again.
      </p>
    </ActionPanel>
  );
}

// ── Upload Reference Panel ────────────────────────────────────────────────────

function UploadReferencePanel({ onClose, onSaved }: { onClose: () => void; onSaved: (doc: ReferenceDoc) => void }) {
  const [attached, setAttached] = useState<{ name: string; base64: string } | null>(null);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passProgress, setPassProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = !submitting && !!attached;

  const processFile = (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) { setError("Only PDF files are supported."); return; }
    if (file.size > 50 * 1024 * 1024) { setError("PDF must be under 50 MB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      setAttached({ name: file.name, base64 });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const PASS_LABELS = ["Terminology", "Patterns", "Methodology", "Instruments"];

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setPassProgress(0);
    setError(null);
    try {
      // Optimistic progress: advance ~every 10s since each pass reads a full PDF
      const interval = setInterval(() => {
        setPassProgress((p) => (p < 3 ? p + 1 : p));
      }, 10000);

      const res = await fetch("/api/coach/reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: attached!.base64, filename: attached!.name, title: title.trim() || undefined }),
      });

      clearInterval(interval);
      setPassProgress(4);

      if (!res.ok) throw new Error("Failed to process");
      const doc = await res.json();
      onSaved(doc);
      onClose();
    } catch {
      setError("Failed to process document. Check your Anthropic API key.");
    } finally {
      setSubmitting(false);
    }
  };

  const progressLabel = submitting
    ? passProgress > 0
      ? `Extracting pass ${passProgress} of 4 — ${PASS_LABELS[passProgress - 1]}…`
      : "Sending to Claude…"
    : "Process Reference";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "var(--bg-overlay)", animation: "fadeIn 200ms ease" }} />
      <div style={{
        position: "relative", width: 440, maxWidth: "100vw", height: "100%",
        background: "var(--bg-surface)", borderLeft: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column",
        animation: "slideInRight 350ms cubic-bezier(0, 0, 0.2, 1)",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>Add Reference Document</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
              Upload a methodology book or guide — runs 4 extraction passes
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 18, padding: 4, lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Drop zone / attached pill */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: 6 }}>PDF File</div>
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }} style={{ display: "none" }} />
            {attached ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "var(--bg-base)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-brand-md)" }}>
                <span style={{ fontSize: 16 }}>📄</span>
                <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{attached.name}</span>
                <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--semantic-info)", padding: "2px 6px", borderRadius: "var(--radius-brand-sm)", border: "1px solid var(--semantic-info)30", background: "var(--semantic-info-muted)" }}>
                  PDF · 4 passes
                </span>
                <button onClick={() => setAttached(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 14, padding: 2, lineHeight: 1 }} title="Remove file">✕</button>
              </div>
            ) : (
              <div
                className={`qp-dropzone${dragging ? " active" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Drop PDF here, or <span style={{ color: "var(--accent-primary)" }}>browse</span></div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Wyckoff methodology, trading guides, playbooks · max 50 MB</div>
              </div>
            )}
          </div>

          {/* Optional title */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              Title <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={attached?.name ?? "e.g. Wyckoff Method of Trading and Investment"}
              style={{
                width: "100%", padding: "9px 12px", background: "var(--bg-input)",
                border: "1px solid var(--border-strong)", borderRadius: "var(--radius-brand-md)",
                color: "var(--text-primary)", fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif",
                outline: "none", boxSizing: "border-box",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
            />
          </div>

          {/* Extraction pass info */}
          <div style={{ padding: "10px 12px", background: "var(--semantic-info-muted)", borderRadius: "var(--radius-brand-md)", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--semantic-info)" }}>4 extraction passes:</strong>
            {" "}Terminology → Patterns → Methodology → Instruments. Each pass reads the full PDF with a focused prompt. This takes 30–60 seconds for a full book.
          </div>

          {/* Progress */}
          {submitting && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PASS_LABELS.map((label, i) => {
                const done = i < passProgress;
                const active = i === passProgress;
                return (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done ? "var(--semantic-positive-muted)" : active ? "var(--accent-muted)" : "var(--bg-elevated)",
                      border: `1px solid ${done ? "var(--semantic-positive)" : active ? "var(--accent-primary)" : "var(--border-default)"}`,
                    }}>
                      {done ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--semantic-positive)" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                      ) : active ? (
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-primary)", animation: "pulse 1s ease infinite" }} />
                      ) : null}
                    </div>
                    <span style={{ fontSize: 12, color: done ? "var(--semantic-positive)" : active ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight: active ? 500 : 400 }}>
                      Pass {i + 1} — {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "var(--semantic-negative)", padding: "8px 12px", background: "var(--semantic-negative-muted)", borderRadius: "var(--radius-brand-sm)" }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--border-default)", display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 16px", borderRadius: "var(--radius-brand-md)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--text-primary)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit} style={{
            flex: 2, padding: "9px 16px", borderRadius: "var(--radius-brand-md)", border: "none",
            background: canSubmit ? "var(--accent-primary)" : "var(--bg-elevated)",
            color: canSubmit ? "var(--text-inverse)" : "var(--text-tertiary)",
            fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 500,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}>
            {progressLabel}
          </button>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Reference List ─────────────────────────────────────────────────────────────

function ReferenceList({ docs, onAdd }: { docs: ReferenceDoc[]; onAdd: () => void }) {
  const statusStyle = (status: ReferenceDoc["status"]) => ({
    processing: { bg: "var(--semantic-warning-muted)", color: "var(--semantic-warning)", label: "Processing…" },
    complete:   { bg: "var(--semantic-positive-muted)", color: "var(--semantic-positive)", label: "Complete" },
    error:      { bg: "var(--semantic-negative-muted)", color: "var(--semantic-negative)", label: "Error" },
  }[status]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Reference Material</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
            {docs.length} {docs.length === 1 ? "document" : "documents"} · 4-pass extraction
          </div>
        </div>
        <button
          onClick={onAdd}
          style={{ padding: "7px 14px", borderRadius: "var(--radius-brand-md)", border: "none", background: "var(--accent-primary)", color: "var(--text-inverse)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "background 120ms ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-primary-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-primary)")}
        >
          + Upload PDF
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>
        {docs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 240, color: "var(--text-tertiary)", fontSize: 13, gap: 12, textAlign: "center", padding: "0 40px" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <div>No reference documents yet.</div>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              Upload a methodology book to extract terminology, patterns, and principles directly into the knowledge base.
            </div>
          </div>
        ) : (
          docs.map((doc) => {
            const s = statusStyle(doc.status);
            return (
              <div key={doc.id} style={{ borderBottom: "1px solid var(--border-subtle)", padding: "12px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: s.color, padding: "2px 7px", borderRadius: "var(--radius-brand-sm)", background: s.bg, flexShrink: 0 }}>
                    {s.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{doc.filename}</span>
                  {doc.extractedKeys.length > 0 && (
                    <span style={{ fontSize: 11, color: "var(--semantic-positive)", flexShrink: 0 }}>{doc.extractedKeys.length} extracted</span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", flexShrink: 0 }}>{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Thesis Timeline ────────────────────────────────────────────────────────────

interface ThesisTimelineProps {
  entries: ThesisEntry[];
  onAdd: () => void;
  onView: (entry: ThesisEntry) => void;
  onDelete: (entry: ThesisEntry) => void;
}

function ThesisTimeline({ entries, onAdd, onView, onDelete }: ThesisTimelineProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Section header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
            Thesis Feed
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"} · newest first
          </div>
        </div>
        <button
          onClick={onAdd}
          style={{
            padding: "7px 14px",
            borderRadius: "var(--radius-brand-md)",
            border: "none",
            background: "var(--accent-primary)",
            color: "var(--text-inverse)",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "background 120ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-primary-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent-primary)")}
        >
          + Add Entry
        </button>
      </div>

      {/* Entries list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>
        {entries.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 240,
              color: "var(--text-tertiary)",
              fontSize: 13,
              gap: 12,
              textAlign: "center",
              padding: "0 40px",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <div>No thesis entries yet.</div>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              Add Coach's documented views on market conditions, trading principles, and more.
              Each entry improves how every future post is parsed.
            </div>
          </div>
        ) : (
          entries.map((entry) => {
            const cfg = getTopicConfig(entry.topic);
            const displayDate = entry.postDate ?? entry.createdAt;
            return (
              <div
                key={entry.id}
                onClick={() => onView(entry)}
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                  padding: "12px 20px",
                  cursor: "pointer",
                  transition: "background var(--duration-fast) var(--ease-default)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                {/* Topic badge + date + trash */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em",
                    color: cfg.color, padding: "2px 7px",
                    borderRadius: "var(--radius-brand-sm)",
                    border: `1px solid ${cfg.color}30`,
                    background: `${cfg.color}10`,
                  }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {formatDate(displayDate)} · {formatTime(displayDate)}
                  </span>
                  {entry.extractedKeys.length > 0 && (
                    <span style={{ fontSize: 11, color: "var(--semantic-positive)" }}>
                      {entry.extractedKeys.length} extracted
                    </span>
                  )}
                  {/* Trash icon — stop propagation so it doesn't open view panel */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(entry); }}
                    title="Delete entry"
                    style={{
                      marginLeft: "auto",
                      background: "none", border: "none",
                      color: "var(--text-tertiary)", cursor: "pointer",
                      padding: 4, borderRadius: "var(--radius-brand-sm)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "color var(--duration-fast) var(--ease-default)",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--semantic-negative)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>

                {/* Summary */}
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {entry.summary}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Learning Progress panel ────────────────────────────────────────────────────

interface LearningStats {
  profileKeyCount: number;
  kbEntryCount: number;
  correctionCount: number;
  refDocCount: number;
}

function LearningProgress({ thesisEntries }: { thesisEntries: ThesisEntry[] }) {
  const [stats, setStats] = useState<LearningStats | null>(null);

  useEffect(() => {
    fetch("/api/coach/stats").then((r) => { if (r.ok) r.json().then(setStats); });
  }, []);

  // Build per-entry bar data from oldest → newest, last 30 entries
  const chartEntries = [...thesisEntries]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-30);

  const maxKeys = Math.max(...chartEntries.map((e) => e.extractedKeys.length), 1);

  // Saturation signal: avg keys for last 5 vs first 5
  const first5 = chartEntries.slice(0, 5);
  const last5 = chartEntries.slice(-5);
  const avgFirst = first5.length ? first5.reduce((s, e) => s + e.extractedKeys.length, 0) / first5.length : 0;
  const avgLast = last5.length ? last5.reduce((s, e) => s + e.extractedKeys.length, 0) / last5.length : 0;
  const saturationPct = avgFirst > 0 ? Math.max(0, Math.min(100, Math.round((1 - avgLast / avgFirst) * 100))) : 0;
  const saturationLabel =
    chartEntries.length < 5 ? "Not enough data yet" :
    saturationPct >= 80 ? "Near saturation" :
    saturationPct >= 50 ? "Converging" :
    saturationPct >= 20 ? "Learning" : "Early stage";
  const saturationColor =
    saturationPct >= 80 ? "var(--semantic-positive)" :
    saturationPct >= 50 ? "var(--semantic-warning)" : "var(--semantic-info)";

  return (
    <div style={{ borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>
          Learning Progress
        </div>
        {/* Stats row */}
        <div style={{ display: "flex", gap: 0 }}>
          {[
            { label: "Profile Keys", value: stats?.profileKeyCount ?? "—" },
            { label: "KB Entries", value: stats?.kbEntryCount ?? "—" },
            { label: "Thesis Entries", value: thesisEntries.length },
            { label: "Corrections", value: stats?.correctionCount ?? "—" },
            { label: "Ref Docs", value: stats?.refDocCount ?? "—" },
          ].map((item, i) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                textAlign: "center",
                paddingRight: i < 4 ? 8 : 0,
                borderRight: i < 4 ? "1px solid var(--border-subtle)" : "none",
                marginRight: i < 4 ? 8 : 0,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}>
                {item.value}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + saturation */}
      <div style={{ padding: "10px 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            New keys per thesis entry
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: saturationColor }}>
            {saturationLabel}
          </div>
        </div>

        {chartEntries.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", padding: "12px 0" }}>
            Add thesis entries to track learning progress
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}>
            {chartEntries.map((entry, i) => {
              const h = Math.max(2, Math.round((entry.extractedKeys.length / maxKeys) * 40));
              const isRecent = i >= chartEntries.length - 5;
              return (
                <div
                  key={entry.id}
                  title={`${new Date(entry.createdAt).toLocaleDateString()} · ${entry.extractedKeys.length} keys`}
                  style={{
                    flex: 1,
                    height: h,
                    borderRadius: 2,
                    background: isRecent ? saturationColor : "var(--accent-primary)",
                    opacity: isRecent ? 1 : 0.45,
                    transition: "height 300ms ease",
                    cursor: "default",
                  }}
                />
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>Oldest</div>
          <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>Most recent →</div>
        </div>
      </div>
    </div>
  );
}

// ── Profile State panel ────────────────────────────────────────────────────────

interface ProfileStateProps {
  entries: ProfileEntry[];
  loading: boolean;
  onDelete: (key: string) => void;
}

function ProfileState({ entries, loading, onDelete }: ProfileStateProps) {
  const groups = groupProfileEntries(entries.filter((e) => !e.key.startsWith("prompt.rule.")));
  const rules = entries.filter((e) => e.key.startsWith("prompt.rule."));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-default)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
          Current Profile
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
          {entries.length} entries · what every parse knows about Coach
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>
        {loading ? (
          <div style={{ padding: "40px 24px", color: "var(--text-tertiary)", fontSize: 13 }}>
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: 200,
              color: "var(--text-tertiary)", fontSize: 13, gap: 8,
            }}
          >
            <div>No profile entries yet.</div>
            <div style={{ fontSize: 12 }}>Seed the knowledge base or add thesis entries.</div>
          </div>
        ) : (
          <>
            {Object.entries(groups).map(([prefix, groupEntries]) => (
              <div key={prefix} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div
                  style={{
                    padding: "10px 20px 4px",
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {prefix}
                </div>
                {groupEntries.map((entry) => (
                  <ProfileRow key={entry.id} entry={entry} onDelete={onDelete} />
                ))}
              </div>
            ))}

            {rules.length > 0 && (
              <div>
                <div
                  style={{
                    padding: "10px 20px 4px",
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-tertiary)",
                  }}
                >
                  Hardened Rules
                </div>
                {rules.map((entry) => (
                  <ProfileRow key={entry.id} entry={entry} onDelete={onDelete} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ entry, onDelete }: { entry: ProfileEntry; onDelete: (key: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const shortKey = entry.key.split(".").slice(1).join(".");
  const displayValue =
    typeof entry.value === "string"
      ? entry.value
      : Array.isArray(entry.value)
      ? (entry.value as string[]).join(", ")
      : JSON.stringify(entry.value);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/profile/${encodeURIComponent(entry.key)}`, { method: "DELETE" });
      if (res.ok) onDelete(entry.key);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="profile-row"
      style={{
        padding: "8px 20px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>
          {shortKey || entry.key}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5, wordBreak: "break-word" }}>
          {displayValue}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: sourceColor(entry.source), textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {sourceLabel(entry.source)}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          {formatDate(entry.lastUpdated)}
        </span>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="profile-row-delete"
        title="Delete entry"
        style={{
          background: "none", border: "none", cursor: deleting ? "not-allowed" : "pointer",
          color: "var(--text-tertiary)", padding: 2, flexShrink: 0, opacity: deleting ? 0.4 : 1,
          alignSelf: "center",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CoachIntelligencePage() {
  const [thesisEntries, setThesisEntries] = useState<ThesisEntry[]>([]);
  const [profileEntries, setProfileEntries] = useState<ProfileEntry[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState<ThesisEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<ThesisEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [leftTab, setLeftTab] = useState<"thesis" | "reference">("thesis");
  const [refDocs, setRefDocs] = useState<ReferenceDoc[]>([]);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);

  const loadThesis = useCallback(async () => {
    const res = await fetch("/api/coach/thesis");
    if (res.ok) setThesisEntries(await res.json());
  }, []);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    const res = await fetch("/api/coach/profile");
    if (res.ok) {
      setProfileEntries(await res.json());
    }
    setProfileLoading(false);
  }, []);

  const loadRefDocs = useCallback(async () => {
    const res = await fetch("/api/coach/reference");
    if (res.ok) {
      const data: ReferenceDoc[] = await res.json();
      setRefDocs(data);
    }
  }, []);

  useEffect(() => {
    loadThesis();
    loadProfile();
    loadRefDocs();
  }, [loadThesis, loadProfile, loadRefDocs]);

  const handleEntrySaved = (entry: ThesisEntry) => {
    setThesisEntries((prev) => [entry, ...prev]);
    // Reload profile to show newly extracted entries
    loadProfile();
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/coach/thesis/${deleteEntry.id}`, { method: "DELETE" });
      if (res.ok) {
        setThesisEntries((prev) => prev.filter((e) => e.id !== deleteEntry.id));
        setDeleteEntry(null);
        setViewEntry(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Top nav bar */}
      <div
        style={{
          height: 52,
          borderBottom: "1px solid var(--border-default)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
          flexShrink: 0,
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--text-tertiary)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
            transition: "color 120ms ease",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-tertiary)")}
        >
          ← Dashboard
        </Link>
        <div style={{ width: 1, height: 16, background: "var(--border-default)" }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
          Coach Intelligence
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: thesis / reference tabs */}
        <div
          style={{
            width: "55%",
            borderRight: "1px solid var(--border-default)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border-default)",
              flexShrink: 0,
              backgroundColor: "var(--bg-surface)",
            }}
          >
            {(["thesis", "reference"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  background: "none",
                  border: "none",
                  borderBottom: leftTab === tab ? "2px solid var(--accent-primary)" : "2px solid transparent",
                  color: leftTab === tab ? "var(--accent-primary)" : "var(--text-tertiary)",
                  cursor: "pointer",
                  transition: "color 120ms ease",
                  marginBottom: -1,
                }}
              >
                {tab === "thesis" ? "Thesis Feed" : "Reference Docs"}
              </button>
            ))}
          </div>

          {leftTab === "thesis" ? (
            <ThesisTimeline
              entries={thesisEntries}
              onAdd={() => setAddPanelOpen(true)}
              onView={(entry) => setViewEntry(entry)}
              onDelete={(entry) => setDeleteEntry(entry)}
            />
          ) : (
            <ReferenceList
              docs={refDocs}
              onAdd={() => setUploadPanelOpen(true)}
            />
          )}
        </div>

        {/* Right: learning progress + profile state */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--bg-base)",
          }}
        >
          <LearningProgress thesisEntries={thesisEntries} />
          <ProfileState
            entries={profileEntries}
            loading={profileLoading}
            onDelete={(key) => setProfileEntries((prev) => prev.filter((e) => e.key !== key))}
          />
        </div>
      </div>

      {/* Add Entry panel */}
      {addPanelOpen && (
        <AddEntryPanel
          onClose={() => setAddPanelOpen(false)}
          onSaved={handleEntrySaved}
        />
      )}

      {/* Upload Reference panel */}
      {uploadPanelOpen && (
        <UploadReferencePanel
          onClose={() => setUploadPanelOpen(false)}
          onSaved={(doc) => {
            setRefDocs((prev) => {
              const without = prev.filter((d) => d.id !== doc.id);
              return [doc, ...without];
            });
            setUploadPanelOpen(false);
            loadProfile();
            loadRefDocs();
          }}
        />
      )}

      {/* View Entry panel */}
      {viewEntry && !deleteEntry && (
        <ThesisViewPanel
          entry={viewEntry}
          onClose={() => setViewEntry(null)}
          onDelete={() => setDeleteEntry(viewEntry)}
        />
      )}

      {/* Delete Entry panel */}
      {deleteEntry && (
        <ThesisDeletePanel
          entry={deleteEntry}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteEntry(null)}
        />
      )}
    </div>
  );
}
