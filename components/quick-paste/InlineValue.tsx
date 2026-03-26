"use client";
import { useEffect, useRef } from "react";

interface InlineValueProps {
  value: string | null;
  field: string;
  editing: boolean;
  onStartEdit: (field: string) => void;
  onEndEdit: () => void;
  onChange: (value: string) => void;
  mono?: boolean;
  placeholder?: string;
  suffix?: string;
}

export function InlineValue({
  value,
  field,
  editing,
  onStartEdit,
  onEndEdit,
  onChange,
  mono = false,
  placeholder = "___",
  suffix = "",
}: InlineValueProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = value != null && value !== "";

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={hasValue ? String(value) : ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onEndEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") onEndEdit();
        }}
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border-focus)",
          borderRadius: 4,
          padding: "2px 6px",
          fontFamily: mono ? "'DM Mono', monospace" : "inherit",
          fontSize: 15,
          color: "var(--text-primary)",
          outline: "none",
          width: Math.max(40, (hasValue ? String(value!).length : placeholder.length) * 9 + 20),
          lineHeight: "1.6",
          display: "inline",
        }}
      />
    );
  }

  return (
    <span
      className="ml-value"
      onClick={() => onStartEdit(field)}
      style={{
        fontFamily: mono ? "'DM Mono', monospace" : "inherit",
        color: hasValue ? "var(--text-primary)" : "var(--text-tertiary)",
        fontWeight: hasValue ? 500 : 400,
      }}
    >
      {hasValue ? (mono && suffix !== "%" ? "$" + value : value) : placeholder}
      {suffix}
    </span>
  );
}
