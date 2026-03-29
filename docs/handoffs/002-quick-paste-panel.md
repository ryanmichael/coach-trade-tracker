# Component Handoff: Quick Paste Action Panel

## Status: Ready for Build
## Priority: P0 (Critical Path Feature)
## Design System Version: 1.2.0
## Prototype Reference: `dashboard-v13.jsx` (React artifact — working prototype with all interactions)

---

## Description

The Quick Paste panel is the primary data ingestion flow for Coachtrack. Users paste Coach's X post text, screenshots, or both. The system parses the content, displays results as a natural-language madlib sentence with inline-editable values, and saves the parsed trade to the feed + watchlist on a single "Add" action.

**What changed from PRD v1.2 (see `prd-updates-v1.3.md` for full delta):**
- Parsed data renders as a **madlib sentence**, not a form grid
- Single **"Add"** CTA replaces three separate save buttons
- Source indicators (📝/📊/🔗) removed — cleaner look
- Confidence bar removed from this screen
- Screenshot ⌘V is **smart-detected** — shows as full-width preview when pasted
- Text field is **collapsible** ("COACH'S GUIDANCE") when a screenshot is present
- OCR extracted text is **collapsible** ("EXTRACTED TEXT")
- New ticker animates into the left panel watchlist on save

---

## File Structure

### New Components
- `apps/web/components/action-panels/QuickPastePanel.tsx` — main panel
- `apps/web/components/quick-paste/MadlibSentence.tsx` — parsed data display
- `apps/web/components/quick-paste/InlineValue.tsx` — click-to-edit inline field
- `apps/web/components/quick-paste/ScreenshotPreview.tsx` — image capture + analysis status
- `apps/web/components/quick-paste/CollapsibleSection.tsx` — reusable chevron toggle pattern

### Modified Components
- `apps/web/components/left-panel/TickerCard.tsx` — add entrance animation class support
- `apps/web/components/layout/LeftPanel.tsx` — dynamic tickers list, scroll-to-top on add
- `apps/web/components/alerts/ToastContainer.tsx` — 5-second auto-dismiss

### New Store
- `apps/web/stores/quick-paste.ts` (Zustand) — all QP panel state

### New Service
- `packages/agents/src/analysis-service.ts` — swappable analysis module (see API Integration section)

---

## Quick Paste Panel Spec

### Trigger Methods
- `Cmd+Shift+V` — global keyboard shortcut, any view
- `"+ Quick Paste"` button — pinned at bottom of left panel
- `"+ Update"` button — on the Primary Post Card in ticker detail view

### Panel Behavior
- **Desktop:** 460px wide side panel, slides from right (350ms, `--ease-out`). Uses shared Action Panel pattern (`.ap-desktop.wide`).
- **Mobile:** Bottom sheet, max 85vh, slides up. Shared pattern (`.ap-mobile`).
- Overlay + ✕ + Cancel all dismiss.

### Panel Layout (top to bottom)

```
┌──────────────────────────────────────────┐
│ [clipboard icon]  Quick Paste        [✕] │  ← Header
│ Paste text, screenshot, or both          │
├──────────────────────────────────────────┤
│                                          │
│  CHART                      ✓ Analyzed   │  ← Screenshot preview (if pasted)
│  ┌──────────────────────────────────┐    │
│  │     [chart image preview]        │ [✕]│
│  └──────────────────────────────────┘    │
│                                          │
│  ▸ EXTRACTED TEXT                         │  ← Collapsible OCR text
│  ▸ COACH'S GUIDANCE                      │  ← Collapsible text input
│                                          │
│  ┌──────────────────────────────────┐    │
│  │ Coach is Bullish on AAPL         │    │  ← Madlib sentence card
│  │ targeting $185 – $190 by 3/20.   │    │
│  │                                  │    │
│  │ Confirmation when price closes   │    │
│  │ above $172.                      │    │
│  │                                  │    │
│  │ Set stop at $165.                │    │
│  │                                  │    │
│  │ Support at $168.50, resistance   │    │
│  │ at $192.                         │    │
│  └──────────────────────────────────┘    │
│          Click any value to edit         │
│                                          │
├──────────────────────────────────────────┤
│                               [ Add ]    │  ← Single CTA
└──────────────────────────────────────────┘
```

### State: No Screenshot Present

When no screenshot has been pasted, the panel shows the default layout:
- Full-width textarea (left) + image drop zone (right) side by side on desktop, stacked on mobile
- Textarea placeholder: "Paste Coach's post or ⌘V a screenshot..."
- Drop zone: dashed border, "Drop or browse" text, click-to-upload

### State: Screenshot Pasted (⌘V)

When the user pastes a screenshot:
1. **Smart detection** — clipboard paste handler checks for image items first. If found, intercepts the event and routes to screenshot processing. If text only, default textarea paste behavior.
2. **Screenshot preview** — full-width image preview appears at the top of the panel body under a "CHART" label. During analysis: image blurs + frosted overlay with animated progress bar ("Analyzing..."). Once done: image un-blurs, "✓ Analyzed" status badge appears next to the CHART label.
3. **Layout shift** — textarea becomes a collapsible "COACH'S GUIDANCE" section (collapsed by default). OCR extracted text appears as a collapsible "EXTRACTED TEXT" section.

### Clipboard Paste Handler

```typescript
// Pseudocode for paste event handler
window.addEventListener('paste', (e) => {
  const imageItem = Array.from(e.clipboardData.items)
    .find(i => i.type.startsWith('image/'));
  
  if (imageItem) {
    e.preventDefault();
    const blob = imageItem.getAsFile();
    const dataUrl = await readBlobAsDataURL(blob); // FileReader
    processScreenshot(dataUrl);
  }
  // else: let default text paste happen in textarea
});
```

**Important:** In production, use `FileReader.readAsDataURL()` to convert the blob before setting state. Blob URLs (`URL.createObjectURL`) may not work in all environments. The `dataUrl` string is what gets stored in state and rendered via `<img src={dataUrl}>`.

---

## Madlib Sentence Spec

### Sentence Template

```
Coach is {Bullish|Bearish} on {TICKER} targeting {$LOW} – {$HIGH} by {DATE}.
Confirmation when price closes {above|below} {$CONFIRMATION}.
Set stop at {$STOP_LOSS}.
Support at {$SUPPORT}, resistance at {$RESISTANCE}.
```

### Rendering Rules

- **Each line is conditional** — only render lines/segments where data exists. Don't show "Set stop at ___." if stopLoss is null.
- **Direction toggles on click** — "Bullish" (green, `--semantic-positive`) clicks to "Bearish" (red, `--semantic-negative`) and vice versa. This also flips the confirmation text from "above" to "below".
- **Price target range** — show "targeting $185 – $190" if both low and high are different. Show just "targeting $185" if they're the same or only one exists.
- **Date** — only show "by {DATE}" if projectedDate is populated.
- **All values are InlineValue components** — display mode with dashed underline, click to edit.

### InlineValue Component

```typescript
interface InlineValueProps {
  value: string | null;
  field: string;           // field key for tracking which is being edited
  editing: boolean;        // controlled by parent state
  onStartEdit: (field: string) => void;
  onEndEdit: () => void;
  onChange: (value: string) => void;
  mono?: boolean;          // use DM Mono for price values
  placeholder?: string;    // shown when value is null/empty
}
```

**Display mode:**
- Dashed underline (`border-bottom: 1px dashed --border-strong`)
- Hover: accent-muted background + accent border
- Populated values: `--text-primary`, weight 500
- Empty values: `--text-tertiary`, shows placeholder
- Mono values auto-prepend "$" in display (not in the input)

**Edit mode:**
- Inline `<input>` replaces the span
- Auto-focused and selected on enter
- `--border-focus` ring
- Auto-width based on content length
- Enter or blur commits and exits edit mode
- Escape exits without committing

### Shimmer Loading

During image analysis, unpopulated values show inline shimmer bars (`ml-shimmer` class) that match the line height. These are inline-block elements that sit within the sentence flow, not full-width blocks.

### CSS Classes

```css
.ml-sentence { font-size: 15px; line-height: 2; color: var(--text-secondary); }
.ml-value { border-bottom: 1px dashed var(--border-strong); padding: 1px 2px; border-radius: 2px; transition: all 150ms; }
.ml-value:hover { background: var(--accent-muted); border-bottom-color: var(--accent-primary); }
.ml-direction { font-weight: 500; cursor: pointer; /* same hover as ml-value */ }
.ml-shimmer { display: inline-block; width: 48px; height: 16px; border-radius: 3px; /* shimmer animation */ }
```

---

## Collapsible Section Pattern

Reusable component used for both "EXTRACTED TEXT" and "COACH'S GUIDANCE".

```
▸ SECTION LABEL        (collapsed — chevron points right)
▾ SECTION LABEL        (expanded — chevron points down)
  [content]
```

- Toggle button: `qp-text-toggle` class — inline-flex, gap 6px, tertiary text, 12px chevron SVG
- Chevron: starts at `rotate(-90deg)` (right), animates to `rotate(0deg)` (down) on open, 200ms ease
- Content wrapper: `qp-text-collapse` class — `max-height: 0; opacity: 0` collapsed, `max-height: 200px; opacity: 1` open, 250ms transition
- Label typography: 11px, weight 500, uppercase, 0.04em tracking (matches all section labels in design system)

---

## Analysis Service (Swappable)

The analysis pipeline is isolated into three functions. The prototype uses mock data; production swaps in real API calls.

```typescript
// packages/agents/src/analysis-service.ts

interface AnalysisResult {
  ticker: string | null;
  direction: 'long' | 'short' | null;
  priceTargetLow: number | null;
  priceTargetHigh: number | null;
  priceConfirmation: number | null;
  stopLoss: number | null;
  support: number | null;
  resistance: number | null;
  projectedDate: string | null;
  postText: string | null;       // OCR'd text from screenshot
  confidence: number;            // 0–1
  summary: string;               // human-readable chart description
  sourceType: 'text' | 'image' | 'combined';
}

// 1. Text parse — runs client-side, <100ms
function parseText(text: string): AnalysisResult | null;

// 2. Screenshot analysis — calls POST /api/parse/image
async function analyzeScreenshot(dataUrl: string): Promise<AnalysisResult>;

// 3. Merge — runs client-side
//    Priority: text > image. Agreement upgrades sourceType to 'combined'.
function mergeResults(textResult: AnalysisResult | null, imageResult: AnalysisResult | null): {
  merged: AnalysisResult;
  sources: Record<string, 'text' | 'image' | 'combined' | null>;
};
```

---

## Save Flow + Watchlist Animation

### On "Add" Click

1. Save `CoachPost` + `ParsedTrade` records via `POST /api/feed/ingest`
2. If ticker doesn't exist in watchlist, create `WatchlistItem` via `POST /api/watchlist` with all parsed fields pre-populated
3. Close panel (350ms slide-out)
4. After 550ms pause (panel fully gone): prepend new ticker card to top of left panel list
5. Scroll list to top smoothly
6. Auto-select the new ticker after entrance animation completes (~1100ms)
7. Show confirmation toast: "Added to feed / {TICKER} saved" (5-second auto-dismiss)

### Ticker Card Entrance Animation

Three chained CSS animations on the `.ticker-new` class:

1. **tickerExpand** (700ms, `cubic-bezier(0.4, 0, 0.2, 1)`) — `max-height: 0 → 80px`, `margin-bottom: 0 → 8px`. Creates space for the card, pushing existing items down smoothly.
2. **tickerReveal** (500ms, starts at 350ms) — `opacity: 0 → 1`, `scale(0.98) → scale(1)`. Content fades in after space has opened.
3. **tickerGlow** (2.2s, starts at 800ms) — indigo `box-shadow` ring pulses outward and fades. Draws the eye.

**Critical:** The left panel ticker list must use **margin-based spacing** (`margin-bottom: 8px` on each card), NOT `gap` on the flex parent. `gap` creates instant jumps; margin can be animated from 0 in the expand keyframe.

### Toast Auto-Dismiss

All toasts (alert toasts + QP save toast) auto-dismiss after 5 seconds. Implementation uses a ref-tracked scheduling map to prevent re-triggering when other toasts are removed:

```typescript
const scheduledDismissals = useRef<Record<string, boolean>>({});

useEffect(() => {
  toasts.forEach(toast => {
    if (scheduledDismissals.current[toast.id]) return;
    scheduledDismissals.current[toast.id] = true;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
      delete scheduledDismissals.current[toast.id];
    }, 5000);
  });
}, [toasts]);
```

---

## Zustand Store: `stores/quick-paste.ts`

```typescript
interface QuickPasteState {
  // Panel
  isOpen: boolean;
  isClosing: boolean;
  
  // Inputs
  rawText: string;
  screenshot: { dataUrl: string; status: 'analyzing' | 'done' | 'error'; result: AnalysisResult | null } | null;
  ocrText: string | null;
  urlDetected: boolean;
  
  // Parse results
  textParsed: AnalysisResult | null;
  analyzing: boolean;
  fields: ParsedFields;
  sources: Record<string, 'text' | 'image' | 'combined' | null>;
  
  // UI
  editingField: string | null;
  showText: boolean;      // Coach's Guidance toggle
  showOcr: boolean;       // Extracted Text toggle
  saved: string | null;   // ticker symbol for toast, null when not showing
  
  // Actions
  open: () => void;
  close: () => void;
  reset: () => void;
  processScreenshot: (dataUrl: string) => Promise<void>;
  save: () => void;
}
```

---

## Testing Checklist

- [ ] Paste text → fields populate instantly (<100ms), madlib renders
- [ ] Paste screenshot → preview shows with progress bar → fields populate after analysis
- [ ] Paste text then drop image → fields merge, image fills gaps
- [ ] Click direction toggle → flips Bullish/Bearish, confirmation wording updates
- [ ] Click any InlineValue → switches to edit mode, focus + select
- [ ] Enter/blur on InlineValue → commits edit, returns to display mode
- [ ] Escape on InlineValue → exits without committing
- [ ] Collapsible sections toggle open/close with chevron rotation
- [ ] "Add" button disabled during analysis
- [ ] Save → panel closes → new ticker animates into watchlist → auto-selects
- [ ] Save existing ticker → updates in place, no duplicate
- [ ] Toast appears on save, auto-dismisses after 5 seconds
- [ ] Mobile: bottom sheet, stacked layout, all interactions work
- [ ] `Cmd+Shift+V` opens panel from any view
