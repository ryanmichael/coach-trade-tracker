# Component Map

Quick reference: what renders where. Read before editing UI.

## Routes

| Route | Page File | Top-Level Components |
|-------|-----------|---------------------|
| `/` | `app/(dashboard)/page.tsx` | LeftPanel + RightPanel + ToastContainer + PricePoller + QuickPastePanel |
| `/tools` | `app/tools/page.tsx` | Tab bar → OptionsFinder OR DelistMonitor |
| `/options-finder` | `app/(dashboard)/options-finder/page.tsx` | OptionsFinder |
| `/coach` | `app/coach/page.tsx` | Coach Profile + Knowledge Base + Thesis History |
| `/settings` | `app/(dashboard)/settings/page.tsx` | Stub (not built) |
| `/test` | `app/(dashboard)/test/page.tsx` | Primitive component showcase |

## Main Dashboard (`/`)

```
LeftPanel (layout/LeftPanel.tsx)
├── LogoHeader (left-panel/LogoHeader.tsx)
│   ├── Radar SVG + "Coachtrack"
│   ├── Brain icon → /coach
│   ├── Tools icon → /tools (with delist alert dot)
│   ├── Bell icon → notification ActionPanel
│   ├── X feed icon → external
│   └── Market status dot + label
├── TickerCard[] (left-panel/TickerCard.tsx) — scrollable list
│   ├── Flag column (ONLY if unread alert)
│   ├── Ticker name + price
│   └── ProximityBadge
├── Quick Paste button (pinned bottom)
└── ActionPanel → AlertHistoryList

RightPanel (layout/RightPanel.tsx)
├── IF no ticker selected:
│   └── Empty state + Quick Paste prompt
└── IF ticker selected:
    └── TickerDetail (right-panel/TickerDetail.tsx)
        ├── Header (ticker + price + ProximityBadge + trash)
        ├── InlineAlert (if unacknowledged)
        ├── PrimaryPostCard (right-panel/PrimaryPostCard.tsx)
        │   ├── TradeSummaryChart (charts/TradeSummaryChart.tsx)
        │   ├── "Latest" label + timestamp + show/hide toggle
        │   ├── Metrics row (Target | Date | Confidence✦)
        │   └── Report footer → ActionPanel → ReportPanel
        └── OlderPostRow[] (right-panel/OlderPostRow.tsx)

QuickPastePanel (action-panels/QuickPastePanel.tsx) — global
├── Textarea + ImageDropZone
├── ScreenshotPreview[] + ImageAnalysisBadge
├── MadlibSentence (parsed summary)
├── Editable fields + FieldSourceIndicator
├── TradeSummaryChart preview
├── ClarifyingQuestionsCard
└── Save buttons (Feed / +Watchlist / +Active)

ToastContainer (alerts/ToastContainer.tsx) — fixed position
```

## Tools Page (`/tools`)

```
Tab bar: "Options Finder" | "Delist Monitor"

OptionsFinder (options-finder/OptionsFinder.tsx)
├── PageHeader
├── TickerSelector (options-finder/TickerSelector.tsx) — UNIFIED panel
│   ├── Coach rec pills (with direction arrows)
│   ├── Custom ticker pills (with ×, warning dot)
│   ├── "+ Add ticker" input
│   └── TradeContext (inline, expands when ticker selected)
│       ├── Edit mode: Current Price (+ refresh icon) | Target | Time Frame
│       └── Read mode: metrics row + Edit button
├── FilterBar (options-finder/FilterBar.tsx)
├── ContractCard[] (options-finder/ContractCard.tsx)
├── SummaryFooter
└── MethodologyNote

AccuracyDashboard (options-finder/AccuracyDashboard.tsx) — separate tab

DelistMonitor (tools/DelistMonitor.tsx)
├── DelistTickerInput
├── Status summary + Check button
├── DelistTickerRow[] (with StatusDot)
└── Check history
```

## Primitives (`components/primitives/`)

| Component | Usage |
|-----------|-------|
| PriceBadge | Price display with semantic color |
| ProximityBadge | "Confirmed ✓" or "X.X% away" (direction-aware) |
| ConfidenceBadge | Parser confidence % + ✦ sparkle |
| SmartAddButton | 3-state: +Add / Update / ✓Added |
| ShimmerLoader | Skeleton loading animation |
| StatusChip | pending/confirmed/entered/closed badges |
| SourceIndicator | 📝 text / 📊 image / 🔗 both / ⚠️ conflict |
| TickerBadge | Pill badge with ticker symbol |
| ProgressBar | Visual progress bar |

## Charts (`components/charts/`)

| Component | Usage |
|-----------|-------|
| TradeSummaryChart | SVG chart in PrimaryPostCard + QuickPaste preview |
| PriceLine | Price data line |
| TimeWindowOverlay | Projected date range band |
| ChartLevelLine | Target/confirmation/stop loss dashed lines |

## Shared Layout

| Component | File | Usage |
|-----------|------|-------|
| ActionPanel | layout/ActionPanel.tsx | Side panel (desktop 400px) / bottom sheet (mobile 85vh) |

Used by: QuickPaste, Delete, Report, ParseFeedback, AlertHistory

## Stores (`stores/`)

| Store | Key State |
|-------|-----------|
| selection | selectedTicker, mobileShowDetail |
| watchlist | items, tracked post IDs |
| alerts | unread alerts, ticker alerts |
| feed | posts data |
| ui | quickPaste open/close |
| options-finder | selectedTicker, customDrafts, contracts, sorting |
