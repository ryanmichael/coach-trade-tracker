# Coachtrack — Design System Update
## Version 1.1.0 → 1.2.0

**Date:** March 12, 2026

Apply these additions to `design-system.md`. Existing tokens and patterns are unchanged.

---

## New Component Patterns

### Madlib Sentence Card

Displays parsed trade data as natural-language sentences with inline-editable values. Used in the Quick Paste panel.

- **Container:** `--bg-base` background, 1px `--border-subtle`, `--radius-md`, 16px 18px padding
- **Typography:** 15px, line-height 2, `--text-secondary` for prose, `--text-primary` weight 500 for populated values
- **InlineValue (display):** `border-bottom: 1px dashed --border-strong`, 1px 2px padding, 2px radius. Hover: `--accent-muted` background, `--border-focus` underline.
- **InlineValue (editing):** Inline `<input>`, `--bg-input` background, `--border-focus` ring, auto-width. DM Mono for price values.
- **Direction toggle:** Inline text ("Bullish" / "Bearish"), click to flip. Bullish: `--semantic-positive`. Bearish: `--semantic-negative`. Same hover treatment as InlineValue.
- **Shimmer placeholder:** Inline-block, 48px wide, 16px tall, 3px radius. Uses existing shimmer animation. Sits within sentence flow.
- **Edit hint:** 11px, `--text-tertiary`, centered below the card: "Click any value to edit"
- **Conditional lines:** Sentence lines only render when data exists. No empty placeholders.

### Collapsible Section Toggle

Reusable disclosure pattern for toggling content visibility. Used for "EXTRACTED TEXT" and "COACH'S GUIDANCE" in Quick Paste.

- **Toggle button:** Inline-flex, gap 6px. Chevron SVG (12px) + label text.
- **Label:** 11px, weight 500, uppercase, 0.04em tracking, `--text-tertiary`. Matches all section labels.
- **Chevron rotation:** `rotate(-90deg)` → `rotate(0deg)` on open, 200ms ease.
- **Content wrapper:** `max-height: 0; opacity: 0` collapsed → `max-height: 200px; opacity: 1` open. 250ms transition.
- **Hover:** `--text-secondary` text color.

### Screenshot Preview (Quick Paste)

Full-width image preview shown when a screenshot is pasted via ⌘V.

- **Container:** `--bg-base` background, 1px `--border-default`, `--radius-md`, overflow hidden.
- **Image:** `width: 100%; height: 200px; object-fit: contain`. Transitions: opacity 0.6s, filter 0.6s.
- **Remove button:** Absolute top-right, 26px circle, `rgba(0,0,0,0.7)` background, hover `--semantic-negative`.
- **Header row** (above image): "CHART" label (section label style) + status badge.
  - Analyzing: "Processing..." in `--text-tertiary`
  - Done: "✓ Analyzed" in `--semantic-positive`, weight 500

**Analyzing state:**
- Image: `opacity: 0.35`, `filter: blur(2px)`
- Overlay: `backdrop-filter: blur(4px)`, `rgba(17,17,19,0.6)` background
- Progress bar: 140px track (`rgba(255,255,255,0.08)`), `--accent-primary` fill, sweeping animation 2.4s

**Done state:**
- Image: full opacity, no filter (smooth 0.6s transition from analyzing)

### Ticker Entrance Animation

Three-phase CSS animation applied when a new ticker is added to the left panel watchlist.

- **Class:** `.ticker-new` on the ticker card element
- **Phase 1 — tickerExpand** (700ms, `cubic-bezier(0.4, 0, 0.2, 1)`): `max-height: 0 → 80px`, `margin-bottom: 0 → 8px`, `border-color: transparent → default`. Opens space, pushing existing cards down.
- **Phase 2 — tickerReveal** (500ms, starts at 350ms): `opacity: 0 → 1`, `scale(0.98) → scale(1)`, `translateY(-2px) → translateY(0)`. Content materializes.
- **Phase 3 — tickerGlow** (2.2s, starts at 800ms): `box-shadow: 0 0 0 0 rgba(124,124,255,0.18) → 0 0 0 3px rgba(124,124,255,0.1) → none`. Indigo ring breathes and fades.
- **Critical:** Ticker list uses `margin-bottom: 8px` per card, NOT `gap` on flex parent (gap cannot be animated for new DOM entries).

### Toast Auto-Dismiss

All toasts auto-dismiss after 5 seconds (changed from 10 seconds in v1.1.0).

- Implementation uses a ref-tracked map to schedule per-toast timers without re-triggering on sibling removals.
- Manual dismiss (✕ click) still works and cancels the auto-timer.

---

## Modified Patterns

### Action Panel — Width Variant

Added `.wide` modifier for the Quick Paste panel.

- **Default (Report, Delete):** 400px wide, max-width 90vw
- **Wide (Quick Paste):** 460px wide, max-width 92vw
- CSS: `.ap-desktop.wide { width: 460px; }`

### Ticker Card — Spacing

Changed from parent `gap` to per-card `margin-bottom` for animation support.

- **Before:** Flex parent with `gap: 8px`
- **After:** Each `.left-card` has `margin-bottom: 8px`. Flex parent has no `gap`.
- Added `box-shadow` to transition list: `transition: background 120ms ease, border-color 120ms ease, box-shadow 300ms ease`

---

## New CSS Classes Reference

```css
/* Madlib */
.ml-sentence    /* Sentence container — font-size, line-height, color */
.ml-value       /* Inline editable value — dashed underline, hover state */
.ml-direction   /* Direction toggle — colored text, pointer cursor */
.ml-shimmer     /* Inline loading placeholder */

/* Collapsible */
.qp-text-toggle       /* Toggle button with chevron */
.qp-text-toggle.open  /* Chevron rotated to down */
.qp-text-collapse      /* Content wrapper — collapsed */
.qp-text-collapse.open /* Content wrapper — expanded */

/* Screenshot */
.qp-ss              /* Screenshot container */
.qp-ss-rm           /* Remove button */
.qp-ss-analyzing    /* Frosted analysis overlay */
.qp-progress-track  /* Progress bar track */
.qp-progress-fill   /* Progress bar animated fill */

/* Ticker animation */
.ticker-new    /* Applied to newly added ticker card */
```

---

## Changelog Entry

Add to the changelog table in `design-system.md`:

| Version | Date | Changes |
|---------|------|---------|
| 1.2.0 | 2026-03-12 | Quick Paste panel patterns: Madlib Sentence Card, InlineValue (click-to-edit), Collapsible Section Toggle, Screenshot Preview with frosted analysis overlay, progress bar animation. Ticker Entrance Animation (3-phase: expand + reveal + glow). Action Panel `.wide` variant (460px). Ticker Card spacing changed from parent gap to per-card margin-bottom. Toast auto-dismiss updated to 5 seconds. Source indicators removed from parsed data display. Confidence bar removed from Quick Paste. Single "Add" CTA replaces three save buttons. |
