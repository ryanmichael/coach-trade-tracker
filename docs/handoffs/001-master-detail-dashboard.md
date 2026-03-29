# Component Handoff: Master-Detail Dashboard Layout

## Status: Ready for Build
## Priority: P0
## Design System Version: 1.1.0

## Description
The entire Coachtrack app lives at one route (`/`). The left panel IS the navigation — clicking items in the left panel controls the right panel. No separate pages for feed, watchlist, or alerts.

## File Structure
All component files to create (placeholders for now):

### Layout
- apps/web/components/layout/LeftPanel.tsx
- apps/web/components/layout/RightPanel.tsx
- apps/web/components/layout/ActionPanel.tsx

### Left Panel Sub-components
- apps/web/components/left-panel/LogoHeader.tsx
- apps/web/components/left-panel/AllPostsCard.tsx
- apps/web/components/left-panel/TickerCard.tsx

### Right Panel Sub-components
- apps/web/components/right-panel/AllPostsFeed.tsx
- apps/web/components/right-panel/TickerDetail.tsx
- apps/web/components/right-panel/PrimaryPostCard.tsx
- apps/web/components/right-panel/OlderPostRow.tsx
- apps/web/components/right-panel/InlineAlert.tsx

### Action Panels
- apps/web/components/action-panels/ReportPanel.tsx
- apps/web/components/action-panels/DeletePanel.tsx

### Alerts
- apps/web/components/alerts/ToastContainer.tsx

### Primitives (new — add to existing primitives dir)
- apps/web/components/primitives/ProximityBadge.tsx
- apps/web/components/primitives/SmartAddButton.tsx
- apps/web/components/primitives/ConfidenceBadge.tsx

## Layout Specs

### Desktop (≥768px)
- Left panel: 290px wide, fixed, full height, bg-surface, border-right border-default
- Right panel: flex 1, overflow-y-auto, bg-base
- Both panels: full viewport height

### Mobile (<768px)
- Left panel: full screen on load
- Selecting a ticker slides right panel in as full-width takeover (mobileShowDetail: true)
- Back button at top of right panel

## State
Selection state lives in stores/selection.ts (Zustand):
- selected: "all" | string (ticker symbol) — "all" shows AllPostsFeed, ticker shows TickerDetail
- mobileShowDetail: boolean — controls mobile panel visibility
- setSelected(value): sets selected, sets mobileShowDetail to true on mobile
- setMobileShowDetail(value): boolean setter

## Route Changes
- app/(dashboard)/layout.tsx — wraps children, no nav items
- app/(dashboard)/page.tsx — the entire master-detail layout
- REMOVE: app/(dashboard)/feed/page.tsx (doesn't belong, app is single route)
- REMOVE: app/(dashboard)/watchlist/page.tsx
- REMOVE: app/(dashboard)/alerts/page.tsx
- KEEP: app/(dashboard)/settings/page.tsx (settings IS its own page at /settings per PRD)
