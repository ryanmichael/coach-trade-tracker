"use client";

import { useState } from "react";

interface DelistTickerInputProps {
  onAdd: (input: string) => Promise<{ added: string[]; duplicates: string[] }>;
  disabled?: boolean;
}

export function DelistTickerInput({ onAdd, disabled }: DelistTickerInputProps) {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;

    const result = await onAdd(trimmed);
    setValue("");

    if (result.added.length > 0 && result.duplicates.length > 0) {
      setFeedback(`Added ${result.added.join(", ")}. Already monitoring: ${result.duplicates.join(", ")}`);
    } else if (result.added.length > 0) {
      setFeedback(`Added ${result.added.join(", ")}`);
    } else if (result.duplicates.length > 0) {
      setFeedback(`Already monitoring: ${result.duplicates.join(", ")}`);
    } else {
      setFeedback("No valid tickers found");
    }

    setTimeout(() => setFeedback(null), 4000);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="SOXS, SQQQ, UVXY"
          disabled={disabled}
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 14,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            backgroundColor: "var(--bg-input)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            color: "var(--text-primary)",
            outline: "none",
            transition: "border-color var(--duration-fast) var(--ease-default)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            backgroundColor: "var(--accent-primary)",
            color: "var(--text-inverse)",
            border: "none",
            borderRadius: "var(--radius-md)",
            cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
            opacity: disabled || !value.trim() ? 0.5 : 1,
            transition: "opacity var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default)",
          }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "var(--accent-primary-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--accent-primary)"; }}
        >
          Add
        </button>
      </div>
      {feedback && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
