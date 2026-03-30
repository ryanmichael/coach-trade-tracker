// SmartAddButton — 3-state watchlist relationship button
// Used on All Posts feed cards to show whether a ticker is on the watchlist.
// States: "add" (outlined), "update" (accent fill), "added" (green badge, inert)

export interface SmartAddButtonProps {
  state: "add" | "update" | "added";
  onAdd?: () => void;
  className?: string;
}

export default function SmartAddButton({
  state,
  onAdd,
  className = "",
}: SmartAddButtonProps) {
  if (state === "added") {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          borderRadius: "var(--radius-brand-sm)",
          padding: "var(--space-1) var(--space-2)",
          backgroundColor: "var(--semantic-positive-muted)",
          color: "var(--semantic-positive)",
          fontSize: "12px",
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          cursor: "default",
          userSelect: "none",
        }}
        aria-label="Already added to watchlist"
      >
        ✓ Added
      </span>
    );
  }

  if (state === "update") {
    return (
      <button
        onClick={onAdd}
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          borderRadius: "var(--radius-brand-md)",
          padding: "0 var(--space-3)",
          height: "32px",
          backgroundColor: "var(--accent-muted)",
          border: "1px solid var(--accent-primary)",
          color: "var(--accent-primary)",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "background-color var(--duration-fast) var(--ease-default)",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "rgba(124,124,255,0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "var(--accent-muted)";
        }}
      >
        Update Watchlist
      </button>
    );
  }

  // state === "add"
  return (
    <button
      onClick={onAdd}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        borderRadius: "var(--radius-brand-md)",
        padding: "0 var(--space-3)",
        height: "32px",
        backgroundColor: "transparent",
        border: "1px solid var(--border-strong)",
        color: "var(--text-primary)",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "pointer",
        transition: "background-color var(--duration-fast) var(--ease-default)",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor =
          "var(--bg-surface-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
      }}
    >
      + Add to Watchlist
    </button>
  );
}

// Named export for convenience
export { SmartAddButton };
