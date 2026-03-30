"use client";
import { useRef, useState, useCallback } from "react";
import type { UploadedImage } from "@/hooks/useQuickPaste";
import { ImageAnalysisBadge } from "./ImageAnalysisBadge";

interface ImageDropZoneProps {
  images: UploadedImage[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  disabled?: boolean;
}

export function ImageDropZone({
  images,
  onAddImages,
  onRemoveImage,
  disabled,
}: ImageDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length) onAddImages(files);
    },
    [disabled, onAddImages]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        onAddImages(Array.from(e.target.files));
        e.target.value = "";
      }
    },
    [onAddImages]
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Drop zone */}
      <div
        className="flex flex-col items-center justify-center rounded cursor-pointer"
        style={{
          border: `1px dashed ${
            isDragging ? "var(--accent-primary)" : "var(--border-strong)"
          }`,
          backgroundColor: isDragging
            ? "var(--accent-muted)"
            : "var(--bg-input)",
          borderRadius: "var(--radius-brand-md)",
          minHeight: "80px",
          padding: "var(--space-4)",
          transition: `background-color var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default)`,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        role="button"
        aria-label="Drop images here or click to upload"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !disabled) fileInputRef.current?.click();
        }}
      >
        <span style={{ fontSize: "20px", marginBottom: "4px" }}>📎</span>
        <span
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Drop images here
          <br />
          or click to upload
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </div>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-col gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              style={{
                backgroundColor: "var(--bg-elevated)",
                borderRadius: "var(--radius-brand-md)",
                border: "1px solid var(--border-default)",
                padding: "var(--space-2)",
              }}
            >
              <div className="flex items-start gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt="Chart preview"
                  style={{
                    width: "48px",
                    height: "48px",
                    objectFit: "cover",
                    borderRadius: "4px",
                    flexShrink: 0,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      marginBottom: "2px",
                    }}
                  >
                    {img.file.name}
                  </div>
                  <ImageAnalysisBadge
                    status={img.status}
                    summary={img.analysis?.summary}
                    ticker={img.analysis?.ticker}
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(img.id);
                  }}
                  style={{
                    color: "var(--text-tertiary)",
                    padding: "2px",
                    flexShrink: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                    lineHeight: 1,
                  }}
                  type="button"
                  aria-label="Remove image"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
