"use client";
import { InlineValue } from "./InlineValue";
import type { ParsedFields } from "@/stores/quick-paste";

interface MadlibSentenceProps {
  fields: ParsedFields;
  sources: Record<string, "text" | "image" | "combined" | null>;
  analyzing: boolean;
  editingField: string | null;
  onStartEdit: (field: string) => void;
  onEndEdit: () => void;
  onFieldChange: (field: keyof ParsedFields, value: string) => void;
  onDirectionToggle: () => void;
}

export function MadlibSentence({
  fields,
  sources,
  analyzing,
  editingField,
  onStartEdit,
  onEndEdit,
  onFieldChange,
  onDirectionToggle,
}: MadlibSentenceProps) {
  const isLong = fields.direction === "long";
  const isWatch = fields.direction === "watch";
  const hasTargetHigh = fields.priceTargetHigh !== "";
  const hasTargetLow = fields.priceTargetLow !== "" && fields.priceTargetLow !== fields.priceTargetHigh;
  const hasDate = fields.projectedDate !== "";
  const hasConfirmation = fields.priceConfirmation !== "";
  const hasStopLoss = fields.stopLoss !== "";
  const hasSupport = fields.support !== "";
  const hasResistance = fields.resistance !== "";

  const directionColor = isWatch
    ? "var(--accent-primary)"
    : isLong
    ? "var(--semantic-positive)"
    : "var(--semantic-negative)";

  const directionLabel = isWatch ? "Watching" : isLong ? "Bullish" : "Bearish";

  return (
    <div>
      <div
        className="ml-sentence"
        style={{
          padding: "16px 18px",
          background: "var(--bg-base)",
          borderRadius: "var(--radius-brand-md)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* ── Keep Watch branch ──────────────────────────────────────────── */}
        {isWatch ? (
          <>
            {/* Line 1: Coach is Watching TICKER — resolves near DATE (or: at a decision point) */}
            <div>
              <span>Coach is </span>
              <span
                className="ml-direction"
                onClick={onDirectionToggle}
                style={{ color: directionColor }}
              >
                Watching
              </span>
              <span> </span>
              {analyzing && !fields.ticker ? (
                <span className="ml-shimmer" />
              ) : (
                <InlineValue
                  value={fields.ticker || null}
                  field="ticker"
                  editing={editingField === "ticker"}
                  onStartEdit={onStartEdit}
                  onEndEdit={onEndEdit}
                  onChange={(v) => onFieldChange("ticker", v.toUpperCase())}
                  placeholder="TICKER"
                />
              )}
              {(hasDate || analyzing) ? (
                <>
                  <span> — pattern likely resolves near </span>
                  {analyzing && !hasDate ? (
                    <span className="ml-shimmer" />
                  ) : (
                    <InlineValue
                      value={fields.projectedDate || null}
                      field="projectedDate"
                      editing={editingField === "projectedDate"}
                      onStartEdit={onStartEdit}
                      onEndEdit={onEndEdit}
                      onChange={(v) => onFieldChange("projectedDate", v)}
                      placeholder="date"
                    />
                  )}
                  <span>.</span>
                </>
              ) : (
                <span> at a decision point.</span>
              )}
            </div>

            {/* Line 2: Bullish break above $[resistance] (+X%), bearish break below $[support] (-Y%). */}
            {(hasResistance || hasSupport || analyzing) && (() => {
              const currentPx = hasConfirmation ? parseFloat(fields.priceConfirmation) : NaN;
              const resPx = hasResistance ? parseFloat(fields.resistance) : NaN;
              const supPx = hasSupport ? parseFloat(fields.support) : NaN;
              const upPct = !isNaN(currentPx) && !isNaN(resPx) && currentPx > 0
                ? `+${((resPx - currentPx) / currentPx * 100).toFixed(1)}%`
                : null;
              const downPct = !isNaN(currentPx) && !isNaN(supPx) && currentPx > 0
                ? `-${((currentPx - supPx) / currentPx * 100).toFixed(1)}%`
                : null;
              return (
                <div>
                  <span>Bullish break above </span>
                  {analyzing && !hasResistance ? (
                    <span className="ml-shimmer" />
                  ) : (
                    <InlineValue
                      value={fields.resistance || null}
                      field="resistance"
                      editing={editingField === "resistance"}
                      onStartEdit={onStartEdit}
                      onEndEdit={onEndEdit}
                      onChange={(v) => onFieldChange("resistance", v)}
                      mono
                      placeholder="___"
                    />
                  )}
                  {upPct && (
                    <span style={{ color: "var(--semantic-positive)", fontSize: "0.9em" }}> {upPct}</span>
                  )}
                  <span>, bearish break below </span>
                  {analyzing && !hasSupport ? (
                    <span className="ml-shimmer" />
                  ) : (
                    <InlineValue
                      value={fields.support || null}
                      field="support"
                      editing={editingField === "support"}
                      onStartEdit={onStartEdit}
                      onEndEdit={onEndEdit}
                      onChange={(v) => onFieldChange("support", v)}
                      mono
                      placeholder="___"
                    />
                  )}
                  {downPct && (
                    <span style={{ color: "var(--semantic-negative)", fontSize: "0.9em" }}> {downPct}</span>
                  )}
                  <span>.</span>
                </div>
              );
            })()}
          </>
        ) : (
          <>
            {/* ── Bullish / Bearish branch ──────────────────────────────── */}
            {/* Line 1: Coach is {Bullish|Bearish} on {TICKER} targeting {$LOW}–{$HIGH} by {DATE} */}
            <div>
              <span>Coach is </span>
              {analyzing && !sources.direction ? (
                <span className="ml-shimmer" />
              ) : (
                <span
                  className="ml-direction"
                  onClick={onDirectionToggle}
                  style={{ color: directionColor }}
                >
                  {directionLabel}
                </span>
              )}
              <span> on </span>
              {analyzing && !fields.ticker ? (
                <span className="ml-shimmer" />
              ) : (
                <InlineValue
                  value={fields.ticker || null}
                  field="ticker"
                  editing={editingField === "ticker"}
                  onStartEdit={onStartEdit}
                  onEndEdit={onEndEdit}
                  onChange={(v) => onFieldChange("ticker", v.toUpperCase())}
                  placeholder="TICKER"
                />
              )}

              {/* Targeting section — only render if at least one target exists */}
              {(hasTargetHigh || analyzing) && (
                <>
                  <span> targeting </span>
                  {analyzing && !hasTargetLow && !hasTargetHigh ? (
                    <span className="ml-shimmer" />
                  ) : (
                    <>
                      {hasTargetLow && (
                        <>
                          <InlineValue
                            value={fields.priceTargetLow || null}
                            field="priceTargetLow"
                            editing={editingField === "priceTargetLow"}
                            onStartEdit={onStartEdit}
                            onEndEdit={onEndEdit}
                            onChange={(v) => onFieldChange("priceTargetLow", v)}
                            mono
                            placeholder="___"
                          />
                          <span> – </span>
                        </>
                      )}
                      <InlineValue
                        value={fields.priceTargetHigh || null}
                        field="priceTargetHigh"
                        editing={editingField === "priceTargetHigh"}
                        onStartEdit={onStartEdit}
                        onEndEdit={onEndEdit}
                        onChange={(v) => onFieldChange("priceTargetHigh", v)}
                        mono
                        placeholder="___"
                      />
                    </>
                  )}
                  {(hasDate || analyzing) && (
                    <>
                      <span> by </span>
                      {analyzing && !hasDate ? (
                        <span className="ml-shimmer" />
                      ) : (
                        <InlineValue
                          value={fields.projectedDate || null}
                          field="projectedDate"
                          editing={editingField === "projectedDate"}
                          onStartEdit={onStartEdit}
                          onEndEdit={onEndEdit}
                          onChange={(v) => onFieldChange("projectedDate", v)}
                          placeholder="date"
                        />
                      )}
                    </>
                  )}
                  <span>.</span>
                </>
              )}
            </div>

            {/* Line 2: Confirmation */}
            {(hasConfirmation || analyzing) && (
              <div>
                <span>Confirmation when price closes </span>
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {isLong ? "above" : "below"}
                </span>
                <span> </span>
                {analyzing && !hasConfirmation ? (
                  <span className="ml-shimmer" />
                ) : (
                  <InlineValue
                    value={fields.priceConfirmation || null}
                    field="priceConfirmation"
                    editing={editingField === "priceConfirmation"}
                    onStartEdit={onStartEdit}
                    onEndEdit={onEndEdit}
                    onChange={(v) => onFieldChange("priceConfirmation", v)}
                    mono
                    placeholder="___"
                  />
                )}
                <span>.</span>
              </div>
            )}

            {/* Line 3: Stop loss */}
            {hasStopLoss && (
              <div>
                <span>Set stop at </span>
                <InlineValue
                  value={fields.stopLoss || null}
                  field="stopLoss"
                  editing={editingField === "stopLoss"}
                  onStartEdit={onStartEdit}
                  onEndEdit={onEndEdit}
                  onChange={(v) => onFieldChange("stopLoss", v)}
                  mono
                  placeholder="___"
                />
                <span>.</span>
              </div>
            )}

            {/* Line 4: Support / Resistance (image-sourced) */}
            {(hasSupport || hasResistance) && (
              <div>
                {hasSupport && (
                  <>
                    <span>Support at </span>
                    <InlineValue
                      value={fields.support || null}
                      field="support"
                      editing={editingField === "support"}
                      onStartEdit={onStartEdit}
                      onEndEdit={onEndEdit}
                      onChange={(v) => onFieldChange("support", v)}
                      mono
                      placeholder="___"
                    />
                  </>
                )}
                {hasSupport && hasResistance && <span>, resistance at </span>}
                {!hasSupport && hasResistance && <span>Resistance at </span>}
                {hasResistance && (
                  <>
                    <InlineValue
                      value={fields.resistance || null}
                      field="resistance"
                      editing={editingField === "resistance"}
                      onStartEdit={onStartEdit}
                      onEndEdit={onEndEdit}
                      onChange={(v) => onFieldChange("resistance", v)}
                      mono
                      placeholder="___"
                    />
                  </>
                )}
                <span>.</span>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6, textAlign: "center" }}>
        Click any value to edit
      </div>
    </div>
  );
}
