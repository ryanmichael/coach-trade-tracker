// TickerBadge — pill-shaped ticker symbol label (AAPL, TSLA, etc.)
// DM Sans 600, uppercase, 12px, 0.02em tracking. accent-muted bg, accent-primary text.

interface TickerBadgeProps {
  ticker: string;
  onClick?: () => void;
  className?: string;
}

export function TickerBadge({ ticker, onClick, className = "" }: TickerBadgeProps) {
  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      className={`inline-flex items-center ${className}`}
      style={{
        backgroundColor: "var(--accent-muted)",
        color: "var(--accent-primary)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-1) var(--space-2)",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        lineHeight: 1,
        border: "none",
        cursor: onClick ? "pointer" : "default",
        transition: `opacity var(--duration-fast) var(--ease-default)`,
      }}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      {ticker.toUpperCase()}
    </Tag>
  );
}
