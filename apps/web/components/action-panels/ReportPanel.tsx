"use client";

import { useState } from "react";

interface ReportPanelProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function ReportPanel({ onSubmit, onCancel }: ReportPanelProps) {
  const [text, setText] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Body */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "var(--text-tertiary)",
            marginBottom: 6,
          }}
        >
          What did the system get wrong?
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='e.g., "Target should be $190 not $185" or "This was a short position, not long" or "The date was end of March, not mid-March"'
          autoFocus
          style={{
            width: "100%",
            minHeight: 100,
            maxHeight: 200,
            resize: "vertical",
            background: "var(--bg-input)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-brand-md)",
            padding: "10px 12px",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 14,
            color: "var(--text-primary)",
            lineHeight: 1.6,
            outline: "none",
            transition: "border-color var(--duration-fast) var(--ease-default)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--border-focus)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
          }}
        />
        <p
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          {"Your feedback helps improve how Coach's posts are interpreted. It won't be shared publicly."}
        </p>
      </div>

      {/* Footer buttons */}
      <div
        style={{
          display: "flex",
          gap: 8,
          paddingTop: 16,
          marginTop: 16,
          borderTop: "1px solid var(--border-default)",
        }}
      >
        <button
          onClick={onCancel}
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
            transition: "background var(--duration-fast) var(--ease-default)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-surface-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => text.trim() && onSubmit(text.trim())}
          disabled={!text.trim()}
          style={{
            flex: 2,
            padding: "9px 16px",
            borderRadius: "var(--radius-brand-md)",
            border: "none",
            background: text.trim() ? "var(--accent-primary)" : "var(--bg-elevated)",
            color: text.trim() ? "var(--text-inverse)" : "var(--text-tertiary)",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: text.trim() ? "pointer" : "not-allowed",
            transition: "background var(--duration-fast) var(--ease-default)",
          }}
          onMouseEnter={(e) => {
            if (text.trim()) {
              e.currentTarget.style.background = "var(--accent-primary-hover)";
            }
          }}
          onMouseLeave={(e) => {
            if (text.trim()) {
              e.currentTarget.style.background = "var(--accent-primary)";
            }
          }}
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}
