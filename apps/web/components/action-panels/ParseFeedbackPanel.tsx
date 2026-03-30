"use client";

import { useState } from "react";

interface ParsedFields {
  ticker: string;
  direction: "long" | "short" | "watch";
  priceTargetLow: string;
  priceTargetHigh: string;
  priceConfirmation: string;
  stopLoss: string;
  projectedDate: string;
  support: string;
  resistance: string;
}

interface ParseFeedbackPanelProps {
  fields: ParsedFields;
  onSubmit: (payload: {
    feedbackText: string;
    fieldsCorrected: string[];
    originalValues: Record<string, string>;
    correctedValues: Record<string, string>;
  }) => void;
  onCancel: () => void;
}

// All fields that could be flagged, in display order
const FIELD_DEFS: { key: keyof ParsedFields; label: string; format?: (v: string) => string }[] = [
  { key: "ticker",           label: "Ticker" },
  { key: "direction",        label: "Direction" },
  { key: "priceTargetHigh",  label: "Target (high)", format: (v) => v ? `$${v}` : "" },
  { key: "priceTargetLow",   label: "Target (low)",  format: (v) => v ? `$${v}` : "" },
  { key: "priceConfirmation",label: "Confirmation",  format: (v) => v ? `$${v}` : "" },
  { key: "stopLoss",         label: "Stop loss",     format: (v) => v ? `$${v}` : "" },
  { key: "projectedDate",    label: "Projected date" },
  { key: "support",          label: "Support",       format: (v) => v ? `$${v}` : "" },
  { key: "resistance",       label: "Resistance",    format: (v) => v ? `$${v}` : "" },
];

export function ParseFeedbackPanel({ fields, onSubmit, onCancel }: ParseFeedbackPanelProps) {
  // Which fields the user has flagged as wrong
  const [wrongFields, setWrongFields] = useState<Set<string>>(new Set());
  // Corrections the user provides for flagged fields
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  // Free-text context
  const [feedbackText, setFeedbackText] = useState("");

  const toggleField = (key: string) => {
    setWrongFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setCorrections((c) => { const n = { ...c }; delete n[key]; return n; });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Can submit if any field flagged (wrong or missing) or free text provided
  const canSubmit = wrongFields.size > 0 || feedbackText.trim().length > 0;

  const handleSubmit = () => {
    const fieldsCorrected = Array.from(wrongFields);
    const originalValues: Record<string, string> = {};
    const correctedValues: Record<string, string> = {};

    for (const key of fieldsCorrected) {
      originalValues[key] = fields[key as keyof ParsedFields] as string ?? "";
      if (corrections[key]?.trim()) {
        correctedValues[key] = corrections[key].trim();
      }
    }

    onSubmit({ feedbackText: feedbackText.trim(), fieldsCorrected, originalValues, correctedValues });
  };

  // Split into extracted (has value) and missing (empty)
  const extractedFields = FIELD_DEFS.filter(({ key }) => {
    const v = fields[key];
    return v && String(v).trim() !== "" && String(v).trim() !== "0";
  });
  const missingFields = FIELD_DEFS.filter(({ key }) => {
    const v = fields[key];
    return !v || String(v).trim() === "" || String(v).trim() === "0";
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Extracted fields — mark as wrong */}
      {extractedFields.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{
            fontSize: 11, fontWeight: 500, textTransform: "uppercase",
            letterSpacing: "0.04em", color: "var(--text-tertiary)",
            marginBottom: 10,
          }}>
            Which fields are wrong?
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {extractedFields.map(({ key, label, format }) => {
              const rawVal = String(fields[key] ?? "");
              const displayVal = format ? format(rawVal) : rawVal;
              const isWrong = wrongFields.has(key);

              return (
                <div key={key}>
                  <button
                    onClick={() => toggleField(key)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-brand-md)",
                      border: "1px solid",
                      borderColor: isWrong ? "var(--semantic-negative)" : "var(--border-default)",
                      background: isWrong ? "var(--semantic-negative-muted)" : "var(--bg-base)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 120ms",
                    }}
                  >
                    <span style={{
                      fontSize: 12,
                      color: isWrong ? "var(--semantic-negative)" : "var(--text-tertiary)",
                      fontWeight: 500,
                      minWidth: 110,
                    }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: 13,
                      fontFamily: "'DM Mono', monospace",
                      color: isWrong ? "var(--semantic-negative)" : "var(--text-primary)",
                      flex: 1,
                      textAlign: "right",
                      marginRight: 10,
                    }}>
                      {displayVal}
                    </span>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: "1.5px solid",
                      borderColor: isWrong ? "var(--semantic-negative)" : "var(--border-strong)",
                      background: isWrong ? "var(--semantic-negative)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 120ms",
                    }}>
                      {isWrong && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      )}
                    </span>
                  </button>

                  {isWrong && (
                    <div style={{ padding: "6px 2px 4px", animation: "fadeInUp 150ms ease" }}>
                      <input
                        autoFocus
                        type="text"
                        value={corrections[key] ?? ""}
                        onChange={(e) => setCorrections((c) => ({ ...c, [key]: e.target.value }))}
                        placeholder={`Correct ${label.toLowerCase()}…`}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "var(--radius-brand-sm)",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 13,
                          color: "var(--text-primary)",
                          outline: "none",
                          transition: "border-color 120ms",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "var(--border-focus)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missing fields — add a value */}
      {missingFields.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{
            fontSize: 11, fontWeight: 500, textTransform: "uppercase",
            letterSpacing: "0.04em", color: "var(--text-tertiary)",
            marginBottom: 10,
          }}>
            What did the system miss?
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {missingFields.map(({ key, label }) => {
              const isAdded = wrongFields.has(key);

              return (
                <div key={key}>
                  <button
                    onClick={() => toggleField(key)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-brand-md)",
                      border: "1px solid",
                      borderColor: isAdded ? "var(--accent-primary)" : "var(--border-subtle)",
                      background: isAdded ? "var(--accent-muted)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 120ms",
                    }}
                  >
                    <span style={{
                      fontSize: 12,
                      color: isAdded ? "var(--accent-primary)" : "var(--text-tertiary)",
                      fontWeight: 500,
                    }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: isAdded ? "var(--accent-primary)" : "var(--text-tertiary)",
                      display: "flex", alignItems: "center", gap: 4,
                    }}>
                      {isAdded ? (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                          Added
                        </>
                      ) : (
                        <>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                          Missing
                        </>
                      )}
                    </span>
                  </button>

                  {isAdded && (
                    <div style={{ padding: "6px 2px 4px", animation: "fadeInUp 150ms ease" }}>
                      <input
                        autoFocus
                        type="text"
                        value={corrections[key] ?? ""}
                        onChange={(e) => setCorrections((c) => ({ ...c, [key]: e.target.value }))}
                        placeholder={`What is the ${label.toLowerCase()}?`}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "var(--radius-brand-sm)",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 13,
                          color: "var(--text-primary)",
                          outline: "none",
                          transition: "border-color 120ms",
                          boxSizing: "border-box",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "var(--border-focus)"; }}
                        onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border-subtle)", marginBottom: 16 }} />

      {/* Free-text context */}
      <p style={{
        fontSize: 11, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.04em", color: "var(--text-tertiary)",
        marginBottom: 8,
      }}>
        Additional context
      </p>
      <textarea
        value={feedbackText}
        onChange={(e) => setFeedbackText(e.target.value)}
        placeholder="Anything else the system should know…"
        style={{
          width: "100%",
          minHeight: 80,
          resize: "none",
          background: "var(--bg-input)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-brand-md)",
          padding: "10px 12px",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 13,
          color: "var(--text-primary)",
          lineHeight: 1.6,
          outline: "none",
          transition: "border-color 120ms",
          boxSizing: "border-box",
          marginBottom: 10,
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--border-focus)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
      />
      <p style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5, marginBottom: 0 }}>
        Flagged fields and corrections are used to update the parse immediately and improve future results.
      </p>

      {/* Footer */}
      <div style={{
        display: "flex", gap: 8, justifyContent: "flex-end",
        paddingTop: 16, borderTop: "1px solid var(--border-default)", marginTop: 16,
      }}>
        <button
          onClick={onCancel}
          style={{
            padding: "7px 16px", borderRadius: "var(--radius-brand-md)",
            border: "1px solid var(--border-strong)", background: "none",
            color: "var(--text-secondary)", fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="btn-primary"
          style={{
            padding: "7px 16px", fontSize: 13,
            opacity: canSubmit ? 1 : 0.35,
            cursor: canSubmit ? "pointer" : "default",
          }}
        >
          Send feedback
        </button>
      </div>
    </div>
  );
}
