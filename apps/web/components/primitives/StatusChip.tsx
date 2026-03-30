// StatusChip — trade status badge: PENDING | CONFIRMED | ENTERED | CLOSED
// Label typography: 12px, weight 500, uppercase, 0.04em tracking.

type TradeStatus = "pending" | "confirmed" | "entered" | "closed";

interface StatusChipProps {
  status: TradeStatus;
  className?: string;
}

const STATUS_STYLES: Record<
  TradeStatus,
  { bg: string; color: string; label: string }
> = {
  pending: {
    bg: "var(--semantic-warning-muted)",
    color: "var(--semantic-warning)",
    label: "Pending",
  },
  confirmed: {
    bg: "var(--semantic-positive-muted)",
    color: "var(--semantic-positive)",
    label: "Confirmed",
  },
  entered: {
    bg: "var(--accent-muted)",
    color: "var(--accent-primary)",
    label: "Entered",
  },
  closed: {
    bg: "var(--bg-elevated)",
    color: "var(--text-tertiary)",
    label: "Closed",
  },
};

export function StatusChip({ status, className = "" }: StatusChipProps) {
  const { bg, color, label } = STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{
        backgroundColor: bg,
        color,
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-1) var(--space-2)",
        fontSize: "12px",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}
