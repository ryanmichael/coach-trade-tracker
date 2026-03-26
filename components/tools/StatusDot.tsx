"use client";

import type { CSSProperties } from "react";

type Status = "green" | "yellow" | "red";

const STATUS_COLORS: Record<Status, string> = {
  green: "var(--semantic-positive)",
  yellow: "var(--semantic-warning)",
  red: "var(--semantic-negative)",
};

interface StatusDotProps {
  status: Status;
  size?: number;
  pulse?: boolean;
  style?: CSSProperties;
}

export function StatusDot({ status, size = 8, pulse, style }: StatusDotProps) {
  const shouldPulse = pulse ?? status === "red";

  return (
    <>
      <span
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: STATUS_COLORS[status],
          flexShrink: 0,
          animation: shouldPulse ? "delistPulse 2.5s ease-in-out infinite" : "none",
          ...style,
        }}
      />
      {shouldPulse && (
        <style>{`
          @keyframes delistPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      )}
    </>
  );
}
