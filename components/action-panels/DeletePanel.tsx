"use client";

interface DeletePanelProps {
  ticker: string;
  postCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeletePanel({
  ticker,
  postCount,
  onConfirm,
  onCancel,
}: DeletePanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Body */}
      <div style={{ flex: 1 }}>
        {/* Warning box */}
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-brand-md)",
            background: "var(--semantic-negative-muted)",
            border: "1px solid var(--semantic-negative)",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--semantic-negative)",
              marginBottom: 4,
            }}
          >
            This action cannot be undone
          </div>
          <div
            style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}
          >
            Removing <strong style={{ color: "var(--text-primary)" }}>{ticker}</strong>{" "}
            will delete {postCount} post{postCount !== 1 ? "s" : ""} and all associated
            parsed trade data from your watchlist. Price monitoring will stop.
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
          You can re-add {ticker} at any time by pasting a new Coach post.
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
          onClick={onConfirm}
          style={{
            flex: 2,
            padding: "9px 16px",
            borderRadius: "var(--radius-brand-md)",
            border: "none",
            background: "var(--semantic-negative)",
            color: "#fff",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            transition: "opacity var(--duration-fast) var(--ease-default)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          Remove {ticker}
        </button>
      </div>
    </div>
  );
}
