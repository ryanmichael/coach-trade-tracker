"use client";

import { useState } from "react";
import type { ParsedFields } from "@/stores/quick-paste";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClarifyingQuestion {
  id: string;
  field: keyof ParsedFields;
  text: string;
  type: "chips" | "input";
  options?: { label: string; value: string }[];
  inputType?: "text" | "number";
  placeholder?: string;
}

interface Props {
  questions: ClarifyingQuestion[];
  onAnswer: (field: keyof ParsedFields, value: string) => void;
  onDismiss: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ClarifyingQuestionsCard({ questions, onAnswer, onDismiss }: Props) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  if (questions.length === 0) return null;

  const handleChip = (question: ClarifyingQuestion, value: string) => {
    onAnswer(question.field, value);
  };

  const handleInputConfirm = (question: ClarifyingQuestion) => {
    const val = inputValues[question.id]?.trim();
    if (!val) return;
    onAnswer(question.field, val);
  };

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "14px 16px 16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-brand-md)",
        animation: "fadeInUp 280ms ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {/* Info dot */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8h.01M12 12v4" strokeLinecap="round" />
          </svg>
          A few questions
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: 12,
            padding: "2px 4px",
            borderRadius: 4,
            transition: "color 120ms",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-tertiary)"; }}
        >
          Skip
        </button>
      </div>

      {/* Questions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {questions.map((q, i) => (
          <div
            key={q.id}
            style={{
              paddingTop: i > 0 ? 14 : 0,
              borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 10,
                lineHeight: 1.4,
              }}
            >
              {q.text}
            </div>

            {/* Chips */}
            {q.type === "chips" && q.options && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleChip(q, opt.value)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: "var(--radius-brand-sm)",
                      border: "1px solid var(--border-strong)",
                      background: "none",
                      color: "var(--text-primary)",
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "all 120ms",
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = "var(--accent-muted)";
                      el.style.borderColor = "var(--accent-primary)";
                      el.style.color = "var(--accent-primary)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = "none";
                      el.style.borderColor = "var(--border-strong)";
                      el.style.color = "var(--text-primary)";
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {q.type === "input" && (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type={q.inputType ?? "text"}
                  placeholder={q.placeholder}
                  value={inputValues[q.id] ?? ""}
                  onChange={(e) =>
                    setInputValues((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInputConfirm(q);
                  }}
                  style={{
                    flex: 1,
                    height: 36,
                    padding: "0 12px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-brand-sm)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontFamily: q.inputType === "number" ? "'DM Mono', monospace" : "'DM Sans', system-ui, sans-serif",
                    outline: "none",
                    transition: "border-color 120ms",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--border-focus)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; }}
                />
                <button
                  onClick={() => handleInputConfirm(q)}
                  disabled={!inputValues[q.id]?.trim()}
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderRadius: "var(--radius-brand-sm)",
                    border: "none",
                    background: "var(--accent-primary)",
                    color: "var(--text-inverse)",
                    fontSize: 13,
                    cursor: inputValues[q.id]?.trim() ? "pointer" : "default",
                    opacity: inputValues[q.id]?.trim() ? 1 : 0.35,
                    transition: "opacity 120ms",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    flexShrink: 0,
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
