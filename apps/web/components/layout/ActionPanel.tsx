"use client";

import { ReactNode, useEffect } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ActionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function ActionPanel({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
}: ActionPanelProps) {
  // Must be called unconditionally — before the early return
  const isMobile = useIsMobile();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay backdrop — desktop only (mobile panel is full-screen) */}
      {!isMobile && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 900,
            background: "var(--bg-overlay)",
            animation: "overlayFadeIn var(--duration-normal) var(--ease-default)",
          }}
        />
      )}

      {/* Panel */}
      {isMobile ? (
        /* Mobile: full-screen takeover */
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 901,
            background: "var(--bg-surface)",
            display: "flex",
            flexDirection: "column",
            animation: "panelSlideUp var(--duration-slow) var(--ease-out)",
          }}
        >
          <PanelInner
            title={title}
            description={description}
            onClose={onClose}
            footer={footer}
          >
            {children}
          </PanelInner>
        </div>
      ) : (
        /* Desktop: right side panel */
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: 400,
            maxWidth: "90vw",
            zIndex: 901,
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            flexDirection: "column",
            animation: "panelSlideInRight var(--duration-slow) var(--ease-out)",
          }}
        >
          <PanelInner
            title={title}
            description={description}
            onClose={onClose}
            footer={footer}
          >
            {children}
          </PanelInner>
        </div>
      )}

      <style>{`
        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes panelSlideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes panelSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

interface PanelInnerProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

function PanelInner({ title, description, onClose, children, footer }: PanelInnerProps) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--border-default)",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}
            >
              {description}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: 18,
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-brand-sm)",
            transition: "color var(--duration-fast) var(--ease-default)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-tertiary)";
          }}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: 20,
        }}
      >
        {children}
      </div>

      {/* Footer (optional) */}
      {footer && (
        <div
          style={{
            padding: "12px 20px 16px",
            borderTop: "1px solid var(--border-default)",
            flexShrink: 0,
          }}
        >
          {footer}
        </div>
      )}
    </>
  );
}
