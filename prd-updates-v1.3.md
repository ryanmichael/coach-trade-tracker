# PRD Updates — v1.2 → v1.3

**Date:** March 12, 2026
**Status:** Design-validated via prototype (`dashboard-v13.jsx`)
**Scope:** Quick Paste panel, Watchlist interactions, Toast system

---

## Summary of Changes

These updates reflect design decisions made during prototyping in Claude Chat. Each change was interactively tested and approved in the working prototype before inclusion here.

---

## 1. Quick Paste — Madlib Sentence Replaces Form Grid

**PRD v1.2 said:** Parsed data shown as a grid of labeled input fields (Ticker, Direction, Price Target, Confirmation, Stop Loss, Support, Resistance, Projected Date) with source indicator icons (📝/📊/🔗) on each field.

**v1.3 changes to:** Parsed data renders as a **natural-language madlib sentence** inside a styled card. Values are displayed inline as part of readable sentences:

```
Coach is Bullish on AAPL targeting $185 – $190 by Mar 20, 2026.
Confirmation when price closes above $172.
Set stop at $165.
Support at $168.50, resistance at $192.
```

**Rationale:** The madlib is faster to scan than a form grid. Traders see the trade thesis at a glance — direction, ticker, levels, and timing — in the same format they'd describe it to someone. Each value is inline-editable (click to edit, Enter/blur to save), so the user retains full control without the visual weight of 8+ form fields.

### Sub-changes

**1a. Source indicators removed.** The 📝/📊/🔗 icons on each field are removed. The system still tracks sources internally (`ParsedTrade.sourceType`), but the UI no longer surfaces per-field provenance. Rationale: visual clutter that didn't help the user make decisions.

**1b. Confidence bar removed from Quick Paste.** The confidence percentage and progress bar are removed from the Quick Paste panel. Confidence is still computed and stored on the `ParsedTrade` record for use in the Primary Post Card's ✦ sparkle badge. Rationale: in the paste flow, the user is reviewing and editing the data — they don't need a confidence score to tell them whether to trust their own edits.

**1c. Direction is a click-to-toggle.** Instead of a Long/Short toggle switch, clicking "Bullish" in the madlib flips it to "Bearish" (and vice versa), color-coded green/red. This also dynamically changes the confirmation text from "closes above" to "closes below".

**1d. Confirmation wording updated.** Was: "Confirmation: [$172.00]". Now: "Confirmation when price closes above $172." (bullish) or "Confirmation when price closes below $62." (bearish). The above/below is driven by the direction field.

**1e. Stop loss wording updated.** Was: "Stop Loss: [$165.00]". Now: "Set stop at $165." on its own line.

**1f. Sentence lines are conditional.** Lines only render when their data exists. No empty placeholders like "Set stop at ___." If the parser didn't extract a stop loss, that line simply doesn't appear.

---

## 2. Quick Paste — Single "Add" Button

**PRD v1.2 said:** Three save actions — "Add to Feed" (Enter), "Add to Feed + Watchlist" (⌘W), "Add to Feed + Active" (⌘A).

**v1.3 changes to:** Single full-width **"Add"** button. Saves the post to feed and creates a watchlist item with all parsed fields pre-populated. The `Cmd+W` and `Cmd+A` keyboard shortcuts are removed.

**Rationale:** During prototyping, the three-button footer felt cluttered and introduced decision paralysis ("which one do I click?"). The primary use case is always the same: get the parsed data into the system. The distinction between watchlist and active trade can happen later from the ticker detail view (promote to active). One button, one action, zero friction.

**Pre-population guarantee still applies:** The single "Add" action saves `CoachPost` + `ParsedTrade` records AND creates a `WatchlistItem` with ALL extracted fields pre-populated (ticker, direction, priceTargetLow, priceTargetHigh, priceConfirmation, projectedDate, stopLoss, supportLevel, resistanceLevel).

---

## 3. Quick Paste — Screenshot Smart Detection

**PRD v1.2 said:** Screenshots go into an image drop zone alongside the text textarea. Both zones visible side by side.

**v1.3 changes to:** When `Cmd+V` is pressed in the panel, the system **checks the clipboard for images first**. If an image is found, it intercepts the paste event and renders a **full-width screenshot preview** at the top of the panel. The text textarea collapses into a togglable "COACH'S GUIDANCE" section (hidden by default). If no image is in the clipboard, the default text paste behavior works normally.

**Layout when screenshot is present:**
1. CHART label + analysis status ("✓ Analyzed" or "Processing...")
2. Full-width image preview with remove button
3. ▸ EXTRACTED TEXT (collapsible — shows OCR'd post text from the screenshot)
4. ▸ COACH'S GUIDANCE (collapsible — textarea for additional text)
5. Madlib sentence card

**Layout when no screenshot:**
1. Textarea (left) + image drop zone (right) — side by side on desktop
2. Madlib sentence card

**Image analysis loading state:** Image blurs (`filter: blur(2px)`, `opacity: 0.35`) with a frosted-glass overlay containing an animated progress bar. On completion, the image smoothly un-blurs (0.6s transition).

---

## 4. Quick Paste — Collapsible Sections

**New pattern:** Two collapsible sections in the Quick Paste panel, both using the same toggle component:

- **EXTRACTED TEXT** — shows OCR'd text from the screenshot analysis. Collapsed by default. Uses the design system's section label typography (11px, 500, uppercase, 0.04em tracking).
- **COACH'S GUIDANCE** — textarea for additional text input. Only appears when a screenshot is present. Collapsed by default.

**Toggle behavior:** Chevron icon rotates from right (▸, collapsed) to down (▾, expanded) with 200ms ease. Content area uses `max-height` + `opacity` CSS transition (250ms).

---

## 5. Watchlist — Animated Ticker Entrance

**PRD v1.2 said:** "Feed updates in real-time" and "If added to watchlist, those views update too."

**v1.3 adds specific choreography:**

1. "Add" clicked → panel closes (350ms slide-out)
2. 550ms pause (panel fully cleared from view)
3. New ticker card **prepends to top** of left panel watchlist
4. Three-phase entrance animation:
   - **tickerExpand** (700ms) — space opens from 0 height, pushing existing cards down smoothly
   - **tickerReveal** (500ms, starts at 350ms) — content fades in at 98% → 100% scale
   - **tickerGlow** (2.2s, starts at 800ms) — soft indigo box-shadow ring pulses and fades
5. List auto-scrolls to top (smooth scroll)
6. New ticker auto-selects after 1100ms (showing its detail in the right panel)

**Critical implementation note:** The left panel ticker list must use `margin-bottom` on each card for spacing, NOT `gap` on the flex parent. `gap` creates instant space jumps when new elements enter the DOM; `margin-bottom` can be animated from 0 in the expand keyframe for a smooth push-down effect.

---

## 6. Toast System — 5-Second Auto-Dismiss

**PRD v1.2 said:** "Auto-dismiss after 10 seconds unless interacted with."

**v1.3 changes to:** All toasts auto-dismiss after **5 seconds**. No pause-on-hover in v1 (can add in v2). Implementation uses a ref-tracked scheduling map to prevent re-triggering when sibling toasts are removed.

**Applies to:** Alert toasts (confirmation, target, stop loss, new post) AND the Quick Paste save confirmation toast.

---

## 7. Action Panel — Width Variant

**Design system v1.1.0 said:** Action panel is 400px wide on desktop.

**v1.3 adds:** A `.wide` variant at **460px** for the Quick Paste panel specifically. The extra width accommodates the madlib sentence card and the text + image side-by-side layout. Report and Delete panels remain at 400px.

---

## Sections NOT Changed

The following PRD v1.2 sections remain as-is:
- §5.2 Ingestion Engine (manual-first hybrid approach)
- §5.3 NLP/Parser Agent (regex + Claude Vision pipeline, merge strategy)
- §5.4 Coach Intelligence Agent (knowledge base, context injection, feedback processing)
- §6.1 Master-Detail Layout
- §6.2 Left Panel (other than animation addition)
- §6.3 Right Panel — All Posts View
- §6.4 Right Panel — Ticker Detail View
- §6.5 Alert System (other than toast timer change)
- §6.7 Coach Intelligence Enrichment
- §6.8 Action Panel Pattern (base pattern unchanged, width variant added)
- §6.9 Report Feedback
- §6.10 Settings
- §7 API Route Definitions
- §8 UI/UX Design Direction
- All data models (Prisma schema)
- All agent architecture
