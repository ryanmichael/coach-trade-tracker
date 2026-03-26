"use client";
import type { SourceType } from "@/lib/parser/types";
import { SourceIndicator, ConflictIndicator } from "@/components/primitives";
import type { ReactNode } from "react";

interface FieldSourceIndicatorProps {
  source?: SourceType;
  hasConflict?: boolean;
  lowConfidence?: boolean;
  label: string;
  children: ReactNode;
}

export function FieldSourceIndicator({
  source,
  hasConflict,
  lowConfidence,
  label,
  children,
}: FieldSourceIndicatorProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label
          style={{
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </label>
        <div className="flex items-center gap-1">
          {hasConflict && <ConflictIndicator />}
          {source && !hasConflict && <SourceIndicator source={source} />}
        </div>
      </div>
      <div
        style={{
          borderRadius: "var(--radius-brand-md)",
          outline: lowConfidence
            ? `1px solid var(--semantic-warning)`
            : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
