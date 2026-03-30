// SourceIndicator — shows where a parsed field value came from
// 📝 text-only  |  📊 image-only  |  🔗 both sources agree
// Rendered inline next to editable fields in the Quick Paste modal.

type SourceType = "text" | "image" | "combined";

interface SourceIndicatorProps {
  source: SourceType;
  /** Show a tooltip on hover — default true */
  showTooltip?: boolean;
  className?: string;
}

const SOURCE_CONFIG: Record<SourceType, { icon: string; label: string; color: string }> = {
  text: {
    icon: "📝",
    label: "From post text",
    color: "var(--text-secondary)",
  },
  image: {
    icon: "📊",
    label: "From chart image",
    color: "var(--semantic-info)",
  },
  combined: {
    icon: "🔗",
    label: "Text and image agree",
    color: "var(--semantic-positive)",
  },
};

export function SourceIndicator({
  source,
  showTooltip = true,
  className = "",
}: SourceIndicatorProps) {
  const { icon, label } = SOURCE_CONFIG[source];

  return (
    <span
      className={`inline-flex items-center leading-none ${className}`}
      style={{
        fontSize: "13px",
        cursor: showTooltip ? "help" : "default",
        flexShrink: 0,
      }}
      title={showTooltip ? label : undefined}
      aria-label={label}
    >
      {icon}
    </span>
  );
}

// ConflictIndicator — shown when text and image disagree on a value
interface ConflictIndicatorProps {
  className?: string;
}

export function ConflictIndicator({ className = "" }: ConflictIndicatorProps) {
  return (
    <span
      className={`inline-flex items-center leading-none ${className}`}
      style={{
        fontSize: "13px",
        cursor: "help",
      }}
      title="Text and image sources conflict — review both values"
      aria-label="Conflicting data — review required"
    >
      ⚠️
    </span>
  );
}
