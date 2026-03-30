"use client";

interface ConflictResolverProps {
  textValue: number | string | null;
  imageValue: number | string | null;
  onResolve: (value: number | string) => void;
}

function formatValue(v: number | string | null): string {
  if (v === null) return "—";
  if (typeof v === "number") return `$${v.toFixed(2)}`;
  return v;
}

export function ConflictResolver({
  textValue,
  imageValue,
  onResolve,
}: ConflictResolverProps) {
  return (
    <div
      className="flex items-center gap-2 mt-1"
      style={{ fontSize: "12px", color: "var(--text-secondary)" }}
    >
      <span>Conflict:</span>
      <button
        onClick={() => textValue !== null && onResolve(textValue)}
        className="flex items-center gap-1 px-2 py-0.5"
        style={{
          backgroundColor: "var(--bg-elevated)",
          color: "var(--text-primary)",
          borderRadius: "var(--radius-brand-sm)",
          cursor: "pointer",
          border: "1px solid var(--border-default)",
          fontSize: "12px",
        }}
        type="button"
        aria-label={`Use text value ${formatValue(textValue)}`}
      >
        📝 {formatValue(textValue)}
      </button>
      <span style={{ color: "var(--text-tertiary)" }}>vs</span>
      <button
        onClick={() => imageValue !== null && onResolve(imageValue)}
        className="flex items-center gap-1 px-2 py-0.5"
        style={{
          backgroundColor: "var(--bg-elevated)",
          color: "var(--text-primary)",
          borderRadius: "var(--radius-brand-sm)",
          cursor: "pointer",
          border: "1px solid var(--border-default)",
          fontSize: "12px",
        }}
        type="button"
        aria-label={`Use image value ${formatValue(imageValue)}`}
      >
        📊 {formatValue(imageValue)}
      </button>
    </div>
  );
}
