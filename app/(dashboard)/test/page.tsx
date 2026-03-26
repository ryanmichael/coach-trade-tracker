"use client";

// Visual test page for all primitive components.
// Visit /test to verify every variant with sample data.

import PriceBadge from "@/components/primitives/PriceBadge";
import ProximityBadge from "@/components/primitives/ProximityBadge";
import SmartAddButton from "@/components/primitives/SmartAddButton";
import ConfidenceBadge from "@/components/primitives/ConfidenceBadge";
import ShimmerLoader, { ShimmerText } from "@/components/primitives/ShimmerLoader";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "var(--space-10)" }}>
      <h2
        style={{
          fontSize: "12px",
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: "var(--space-4)",
          paddingBottom: "var(--space-2)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "center" }}>
        {children}
      </div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "flex-start" }}>
      {children}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{children}</span>
  );
}

export default function TestPage() {
  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "var(--space-10) var(--space-6)",
      }}
    >
      <h1
        style={{
          fontSize: "24px",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
          marginBottom: "var(--space-2)",
        }}
      >
        Primitives
      </h1>
      <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "var(--space-10)" }}>
        Visual verification for all primitive components.
      </p>

      {/* ── PriceBadge ─────────────────────────────────────── */}
      <Section title="PriceBadge">
        <Label>
          <PriceBadge value={172.5} size="sm" sentiment="neutral" />
          <Caption>sm · neutral</Caption>
        </Label>
        <Label>
          <PriceBadge value={172.5} size="md" sentiment="neutral" />
          <Caption>md · neutral</Caption>
        </Label>
        <Label>
          <PriceBadge value={172.5} size="lg" sentiment="neutral" />
          <Caption>lg · neutral</Caption>
        </Label>
        <Label>
          <PriceBadge value={18.5} size="md" sentiment="positive" showSign />
          <Caption>positive · showSign</Caption>
        </Label>
        <Label>
          <PriceBadge value={-12.3} size="md" sentiment="negative" showSign />
          <Caption>negative · showSign</Caption>
        </Label>
        <Label>
          <PriceBadge value={4.7} size="md" isPercent sentiment="positive" showSign />
          <Caption>percent · positive</Caption>
        </Label>
        <Label>
          <PriceBadge value={-2.1} size="md" isPercent sentiment="negative" showSign />
          <Caption>percent · negative</Caption>
        </Label>
      </Section>

      {/* ── ProximityBadge ─────────────────────────────────── */}
      <Section title="ProximityBadge">
        <Label>
          <ProximityBadge currentPrice={172.5} confirmationPrice={170} direction="long" />
          <Caption>long · confirmed ($172.50 ≥ $170)</Caption>
        </Label>
        <Label>
          <ProximityBadge currentPrice={168.0} confirmationPrice={172.0} direction="long" />
          <Caption>long · near (1.9% away)</Caption>
        </Label>
        <Label>
          <ProximityBadge currentPrice={162.0} confirmationPrice={172.0} direction="long" />
          <Caption>long · medium (5.8% away)</Caption>
        </Label>
        <Label>
          <ProximityBadge currentPrice={145.0} confirmationPrice={172.0} direction="long" />
          <Caption>long · far (15.7% away)</Caption>
        </Label>
        <Label>
          <ProximityBadge currentPrice={27.3} confirmationPrice={28.0} direction="short" />
          <Caption>short · confirmed ($27.30 ≤ $28)</Caption>
        </Label>
        <Label>
          <ProximityBadge currentPrice={28.5} confirmationPrice={28.0} direction="short" />
          <Caption>short · near (1.8% away)</Caption>
        </Label>
        <Label>
          <ProximityBadge currentPrice={32.0} confirmationPrice={28.0} direction="short" />
          <Caption>short · far (14.3% away)</Caption>
        </Label>
      </Section>

      {/* ── SmartAddButton ─────────────────────────────────── */}
      <Section title="SmartAddButton">
        <Label>
          <SmartAddButton state="add" onAdd={() => alert("Add clicked")} />
          <Caption>add — outlined</Caption>
        </Label>
        <Label>
          <SmartAddButton state="update" onAdd={() => alert("Update clicked")} />
          <Caption>update — accent fill</Caption>
        </Label>
        <Label>
          <SmartAddButton state="added" />
          <Caption>added — inert badge</Caption>
        </Label>
      </Section>

      {/* ── ConfidenceBadge ────────────────────────────────── */}
      <Section title="ConfidenceBadge">
        <Label>
          <ConfidenceBadge value={0.92} onSparkleClick={() => alert("Sparkle clicked")} />
          <Caption>92% — high confidence</Caption>
        </Label>
        <Label>
          <ConfidenceBadge value={0.67} />
          <Caption>67% — medium</Caption>
        </Label>
        <Label>
          <ConfidenceBadge value={0.34} />
          <Caption>34% — low</Caption>
        </Label>
        <Label>
          <ConfidenceBadge value={1.0} onSparkleClick={() => {}} />
          <Caption>100% — max</Caption>
        </Label>
      </Section>

      {/* ── ShimmerLoader ──────────────────────────────────── */}
      <Section title="ShimmerLoader">
        <Label>
          <ShimmerLoader width="120px" height="36px" />
          <Caption>input height (36px)</Caption>
        </Label>
        <Label>
          <ShimmerLoader width="200px" height="14px" rounded="var(--radius-brand-sm)" />
          <Caption>text line (14px)</Caption>
        </Label>
        <Label>
          <ShimmerLoader width="180px" height="120px" />
          <Caption>image placeholder</Caption>
        </Label>
        <Label>
          <ShimmerText chars={8} />
          <Caption>ShimmerText (8 chars)</Caption>
        </Label>
        <Label>
          <ShimmerText chars={16} />
          <Caption>ShimmerText (16 chars)</Caption>
        </Label>
      </Section>

      {/* ── Composition sample ─────────────────────────────── */}
      <Section title="Composition — Ticker Card Excerpt">
        <div
          style={{
            width: "260px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-brand-md)",
            padding: "var(--space-3) var(--space-4)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
                marginBottom: "2px",
              }}
            >
              AAPL
            </div>
            <PriceBadge value={172.5} size="sm" sentiment="neutral" />
          </div>
          <ProximityBadge currentPrice={172.5} confirmationPrice={170} direction="long" />
        </div>
      </Section>

      <Section title="Composition — Feed Card Excerpt">
        <div
          style={{
            width: "320px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-brand-md)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
          }}
        >
          <div
            style={{
              height: "80px",
              backgroundColor: "var(--bg-elevated)",
              borderRadius: "var(--radius-brand-sm)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                color: "var(--text-primary)",
              }}
            >
              NVDA
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>2h ago</span>
          </div>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
            $NVDA looking strong here. PT $310 by end of month. Entry above…
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <SmartAddButton state="add" onAdd={() => {}} />
            <ConfidenceBadge value={0.87} />
          </div>
        </div>
      </Section>
    </div>
  );
}
