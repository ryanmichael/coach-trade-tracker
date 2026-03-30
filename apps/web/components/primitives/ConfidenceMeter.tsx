// ConfidenceMeter — visualizes NLP parser confidence score (0–1)
// Color: semantic-positive >0.8 / semantic-warning 0.5–0.8 / semantic-negative <0.5

interface ConfidenceMeterProps {
  /** Confidence score from 0 to 1 */
  confidence: number;
  /** Show numeric percentage label — default true */
  showLabel?: boolean;
  className?: string;
}

function getColor(confidence: number): string {
  if (confidence >= 0.8) return "var(--semantic-positive)";
  if (confidence >= 0.5) return "var(--semantic-warning)";
  return "var(--semantic-negative)";
}

function getMutedColor(confidence: number): string {
  if (confidence >= 0.8) return "var(--semantic-positive-muted)";
  if (confidence >= 0.5) return "var(--semantic-warning-muted)";
  return "var(--semantic-negative-muted)";
}

export function ConfidenceMeter({
  confidence,
  showLabel = true,
  className = "",
}: ConfidenceMeterProps) {
  const clamped = Math.max(0, Math.min(1, confidence));
  const pct = Math.round(clamped * 100);
  const fillColor = getColor(clamped);
  const labelColor = getColor(clamped);
  const trackColor = getMutedColor(clamped);

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Parser confidence: ${pct}%`}
    >
      {/* Track */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          height: "4px",
          borderRadius: "9999px",
          backgroundColor: trackColor,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: "9999px",
            backgroundColor: fillColor,
            transition: `width var(--duration-normal) var(--ease-out)`,
          }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span
          style={{
            fontFamily: "var(--font-mono), 'DM Mono', monospace",
            fontSize: "12px",
            fontWeight: 400,
            color: labelColor,
            lineHeight: 1,
            minWidth: "32px",
            textAlign: "right",
          }}
        >
          {pct}%
        </span>
      )}
    </div>
  );
}
