"use client";
import { ReactNode } from "react";

interface CollapsibleSectionProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export function CollapsibleSection({ label, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div>
      <button className={`qp-text-toggle${open ? " open" : ""}`} onClick={onToggle}>
        <ChevronIcon />
        <span>{label}</span>
      </button>
      <div className={`qp-text-collapse${open ? " open" : ""}`}>
        <div style={{ paddingTop: 8 }}>{children}</div>
      </div>
    </div>
  );
}
