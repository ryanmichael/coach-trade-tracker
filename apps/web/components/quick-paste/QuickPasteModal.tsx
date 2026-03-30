"use client";
import { useEffect, useRef, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { useQuickPaste } from "@/hooks/useQuickPaste";
import { ParsePreview } from "./ParsePreview";
import { ImageDropZone } from "./ImageDropZone";
import { toast } from "sonner";

export function QuickPasteModal() {
  const { isQuickPasteOpen, closeQuickPaste } = useUIStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = useCallback(() => {
    closeQuickPaste();
  }, [closeQuickPaste]);

  const qp = useQuickPaste(handleClose);

  // Reset and focus when modal opens
  useEffect(() => {
    if (isQuickPasteOpen) {
      qp.reset();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuickPasteOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isQuickPasteOpen) closeQuickPaste();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isQuickPasteOpen, closeQuickPaste]);

  // Cmd+W / Cmd+A shortcuts inside modal
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (!isQuickPasteOpen) return;
      if (e.metaKey && e.key === "w") {
        e.preventDefault();
        await handleSave("feed_watchlist");
      }
      if (e.metaKey && e.key === "a") {
        e.preventDefault();
        await handleSave("feed_active");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuickPasteOpen]);

  // Handle image paste from clipboard into textarea
  const handleTextareaPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) {
        e.preventDefault();
        qp.addImages(files);
      }
    },
    [qp]
  );

  const handleSave = useCallback(
    async (action: "feed_only" | "feed_watchlist" | "feed_active") => {
      const success = await qp.save(action);
      if (success) {
        const labels: Record<typeof action, string> = {
          feed_only: "Saved to Feed",
          feed_watchlist: "Added to Feed + Watchlist",
          feed_active: "Added to Feed + Active Trades",
        };
        toast.success(labels[action]);
      } else {
        toast.error("Failed to save — please try again");
      }
    },
    [qp]
  );

  if (!isQuickPasteOpen) return null;

  const hasTrades = qp.mergedTrades.length > 0;
  const canSave = qp.text.trim().length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "var(--bg-overlay)" }}
        onClick={closeQuickPaste}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Quick Paste Coach Post"
      >
        <div
          className="relative flex flex-col w-full overflow-hidden"
          style={{
            maxWidth: "720px",
            maxHeight: "90vh",
            backgroundColor: "var(--bg-elevated)",
            borderRadius: "var(--radius-brand-lg)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-default)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            <div>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                Quick Paste Coach Post
              </h2>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--text-tertiary)",
                  marginTop: "2px",
                  marginBottom: 0,
                }}
              >
                Paste text · Drop images · Fields auto-fill
              </p>
            </div>
            <button
              onClick={closeQuickPaste}
              style={{
                color: "var(--text-tertiary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                fontSize: "18px",
                lineHeight: 1,
              }}
              aria-label="Close modal"
              type="button"
            >
              ✕
            </button>
          </div>

          {/* Body — two-panel layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left panel: text + parsed fields (60%) */}
            <div
              className="flex flex-col overflow-hidden"
              style={{
                width: "60%",
                borderRight: "1px solid var(--border-default)",
              }}
            >
              <textarea
                ref={textareaRef}
                value={qp.text}
                onChange={(e) => qp.handleTextChange(e.target.value)}
                onPaste={handleTextareaPaste}
                placeholder="Paste Coach's post here…"
                className="resize-none outline-none p-5"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-sans), 'DM Sans', sans-serif",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  minHeight: "140px",
                  maxHeight: "200px",
                  flexShrink: 0,
                  border: "none",
                }}
                aria-label="Post text"
              />

              {/* Parsed fields */}
              <div
                className="flex-1 overflow-y-auto px-5 pb-5"
                style={{ borderTop: "1px solid var(--border-default)" }}
              >
                {(hasTrades || qp.isParsingText) && (
                  <div className="pt-4">
                    <p
                      className="mb-3 flex items-center gap-2"
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--text-tertiary)",
                        margin: 0,
                        marginBottom: "12px",
                      }}
                    >
                      Parsed Data
                      <span
                        style={{
                          fontSize: "10px",
                          letterSpacing: "0.02em",
                          fontWeight: 400,
                        }}
                      >
                        📝 Text · 📊 Image · 🔗 Combined
                      </span>
                    </p>
                    <ParsePreview
                      trades={qp.mergedTrades}
                      conflicts={qp.conflicts}
                      isParsingText={qp.isParsingText}
                      onFieldChange={qp.updateField}
                    />
                  </div>
                )}
                {!hasTrades && !qp.isParsingText && qp.text.trim() === "" && (
                  <div
                    className="flex items-center justify-center py-8"
                    style={{ color: "var(--text-tertiary)", fontSize: "13px" }}
                  >
                    Paste a post above to see extracted trade data
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: images (40%) */}
            <div
              className="flex flex-col overflow-y-auto p-5"
              style={{ width: "40%" }}
            >
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                  marginBottom: "12px",
                  marginTop: 0,
                }}
              >
                Chart Images
              </p>
              <ImageDropZone
                images={qp.images}
                onAddImages={qp.addImages}
                onRemoveImage={qp.removeImage}
              />
            </div>
          </div>

          {/* Footer — save actions */}
          <div
            className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{
              borderTop: "1px solid var(--border-default)",
              backgroundColor: "var(--bg-elevated)",
            }}
          >
            <button
              onClick={() => handleSave("feed_only")}
              disabled={!canSave || qp.isSaving}
              className="btn-secondary"
              type="button"
            >
              Add to Feed
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave("feed_watchlist")}
                disabled={!canSave || !hasTrades || qp.isSaving}
                className="btn-secondary"
                type="button"
                title="⌘W"
              >
                + Watchlist
                <kbd
                  style={{
                    marginLeft: "6px",
                    fontSize: "10px",
                    opacity: 0.5,
                    fontFamily: "inherit",
                  }}
                >
                  ⌘W
                </kbd>
              </button>

              <button
                onClick={() => handleSave("feed_active")}
                disabled={!canSave || !hasTrades || qp.isSaving}
                className="btn-primary"
                type="button"
                title="⌘A"
              >
                {qp.isSaving ? (
                  "Saving…"
                ) : (
                  <>
                    + Active Trade
                    <kbd
                      style={{
                        marginLeft: "6px",
                        fontSize: "10px",
                        opacity: 0.6,
                        fontFamily: "inherit",
                      }}
                    >
                      ⌘A
                    </kbd>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
