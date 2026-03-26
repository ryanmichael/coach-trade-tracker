"use client";

// ConfidenceBadge — parser confidence percentage with ✦ sparkle icon
// DM Mono for the number, ✦ sparkle in accent color (60% opacity, brightens on hover).
// Sparkle is a clickable affordance for future AI explainability panel.

import { useState } from "react";

export interface ConfidenceBadgeProps {
  /** Confidence value from 0.0 to 1.0 */
  value: number;
  onSparkleClick?: () => void;
  className?: string;
}

export default function ConfidenceBadge({
  value,
  onSparkleClick,
  className = "",
}: ConfidenceBadgeProps) {
  const [sparkleHovered, setSparkleHovered] = useState(false);
  const pct = Math.round(value * 100);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono), 'DM Mono', monospace",
          fontSize: "14px",
          fontWeight: 400,
          color: "var(--text-primary)",
          letterSpacing: 0,
        }}
        data-financial
      >
        {pct}%
      </span>
      <button
        onClick={onSparkleClick}
        onMouseEnter={() => setSparkleHovered(true)}
        onMouseLeave={() => setSparkleHovered(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          padding: "0",
          cursor: onSparkleClick ? "pointer" : "default",
          fontSize: "12px",
          color: "var(--accent-primary)",
          opacity: sparkleHovered ? 1 : 0.6,
          transition: "opacity var(--duration-fast) var(--ease-default)",
          lineHeight: 1,
        }}
        aria-label="AI confidence explanation (coming soon)"
        title="AI confidence explanation (coming soon)"
      >
        ✦
      </button>
    </span>
  );
}

// Named export for convenience
export { ConfidenceBadge };
