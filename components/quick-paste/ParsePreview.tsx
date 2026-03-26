"use client";
import type { ParsedTradeData } from "@/lib/parser/types";
import { ConfidenceMeter, SourceIndicator, ShimmerLoader } from "@/components/primitives";
import { FieldSourceIndicator } from "./FieldSourceIndicator";
import { ConflictResolver } from "./ConflictResolver";

interface ParsePreviewProps {
  trades: ParsedTradeData[];
  conflicts: Array<{
    field: string;
    textValue: number | string | null;
    imageValue: number | string | null;
  }>;
  isParsingText: boolean;
  onFieldChange: (
    tradeIndex: number,
    field: keyof ParsedTradeData,
    value: unknown
  ) => void;
}

function PriceInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      step="0.01"
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : parseFloat(e.target.value))
      }
      placeholder={placeholder ?? "—"}
      className="input-base"
      style={{ fontFamily: "var(--font-mono), 'DM Mono', monospace" }}
    />
  );
}

export function ParsePreview({
  trades,
  conflicts,
  isParsingText,
  onFieldChange,
}: ParsePreviewProps) {
  // Build a lookup by field name for quick conflict checking
  const conflictMap = Object.fromEntries(
    conflicts.map((c) => [c.field, c])
  );

  if (isParsingText && trades.length === 0) {
    return (
      <div className="flex flex-col gap-3 pt-2">
        <ShimmerLoader height="14px" width="60%" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <ShimmerLoader key={i} height="36px" />
          ))}
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-8"
        style={{ color: "var(--text-tertiary)", fontSize: "14px" }}
      >
        Paste a post above to see extracted trade data
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {trades.map((trade, idx) => (
        <div key={idx} className="flex flex-col gap-4">
          {/* Ticker row: symbol + direction + source + confidence */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                  color: "var(--text-primary)",
                }}
              >
                {trade.ticker}
              </span>
              <select
                value={trade.direction}
                onChange={(e) =>
                  onFieldChange(idx, "direction", e.target.value)
                }
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-brand-sm)",
                  fontSize: "12px",
                  padding: "2px 6px",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
              <SourceIndicator source={trade.sourceType} showTooltip />
            </div>
            <ConfidenceMeter
              confidence={trade.confidence}
              showLabel
              className="w-32"
            />
          </div>

          {/* Price fields grid */}
          <div className="grid grid-cols-2 gap-3">
            <FieldSourceIndicator
              label="Target Low"
              source={
                !conflictMap["priceTargetLow"]
                  ? trade.sourceType
                  : undefined
              }
              hasConflict={!!conflictMap["priceTargetLow"]}
            >
              <PriceInput
                value={trade.priceTargetLow}
                onChange={(v) => onFieldChange(idx, "priceTargetLow", v)}
                placeholder="$0.00"
              />
              {conflictMap["priceTargetLow"] && (
                <ConflictResolver
                  textValue={conflictMap["priceTargetLow"].textValue}
                  imageValue={conflictMap["priceTargetLow"].imageValue}
                  onResolve={(v) => onFieldChange(idx, "priceTargetLow", v)}
                />
              )}
            </FieldSourceIndicator>

            <FieldSourceIndicator
              label="Target High"
              source={
                !conflictMap["priceTargetHigh"]
                  ? trade.sourceType
                  : undefined
              }
              hasConflict={!!conflictMap["priceTargetHigh"]}
            >
              <PriceInput
                value={trade.priceTargetHigh}
                onChange={(v) => onFieldChange(idx, "priceTargetHigh", v)}
                placeholder="$0.00"
              />
              {conflictMap["priceTargetHigh"] && (
                <ConflictResolver
                  textValue={conflictMap["priceTargetHigh"].textValue}
                  imageValue={conflictMap["priceTargetHigh"].imageValue}
                  onResolve={(v) => onFieldChange(idx, "priceTargetHigh", v)}
                />
              )}
            </FieldSourceIndicator>

            <FieldSourceIndicator
              label="Confirmation"
              source={
                !conflictMap["priceConfirmation"]
                  ? trade.sourceType
                  : undefined
              }
              hasConflict={!!conflictMap["priceConfirmation"]}
            >
              <PriceInput
                value={trade.priceConfirmation}
                onChange={(v) => onFieldChange(idx, "priceConfirmation", v)}
                placeholder="$0.00"
              />
              {conflictMap["priceConfirmation"] && (
                <ConflictResolver
                  textValue={conflictMap["priceConfirmation"].textValue}
                  imageValue={conflictMap["priceConfirmation"].imageValue}
                  onResolve={(v) =>
                    onFieldChange(idx, "priceConfirmation", v)
                  }
                />
              )}
            </FieldSourceIndicator>

            <FieldSourceIndicator
              label="Stop Loss"
              source={trade.sourceType}
            >
              <PriceInput
                value={trade.stopLoss}
                onChange={(v) => onFieldChange(idx, "stopLoss", v)}
                placeholder="$0.00"
              />
            </FieldSourceIndicator>

            <FieldSourceIndicator
              label="Support"
              source={trade.sourceType}
            >
              <PriceInput
                value={trade.supportLevel}
                onChange={(v) => onFieldChange(idx, "supportLevel", v)}
                placeholder="$0.00"
              />
            </FieldSourceIndicator>

            <FieldSourceIndicator
              label="Resistance"
              source={trade.sourceType}
            >
              <PriceInput
                value={trade.resistanceLevel}
                onChange={(v) => onFieldChange(idx, "resistanceLevel", v)}
                placeholder="$0.00"
              />
            </FieldSourceIndicator>
          </div>

          {/* Projected date — full width */}
          <FieldSourceIndicator
            label="Projected Date"
            source={trade.sourceType}
          >
            <input
              type="text"
              value={trade.projectedDate ?? ""}
              onChange={(e) =>
                onFieldChange(
                  idx,
                  "projectedDate",
                  e.target.value || null
                )
              }
              placeholder="e.g. 2026-03-20 or 'end of month'"
              className="input-base"
            />
          </FieldSourceIndicator>
        </div>
      ))}
    </div>
  );
}
