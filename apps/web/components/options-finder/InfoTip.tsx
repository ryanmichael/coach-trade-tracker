"use client";

import { useState } from "react";

interface InfoTipProps {
  text: string;
}

export function InfoTip({ text }: InfoTipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "transparent",
          border: "1px solid rgba(99,99,110,0.55)",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          fontSize: 8,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          lineHeight: 1,
        }}
      >
        i
      </button>
      {visible && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            padding: "6px 10px",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 10,
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {text}
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid var(--border-strong)",
            }}
          />
        </div>
      )}
    </div>
  );
}
