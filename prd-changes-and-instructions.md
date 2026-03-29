# PRD Changes & Claude Code Instructions

## Summary of Design Decisions That Impact the PRD

The prototype sessions produced significant UX changes. This document lists every PRD section affected, what changed, and provides the Claude Code prompt to update the PRD and build accordingly.

---

## Change Log

### 1. LAYOUT: Multi-page → Single-page master-detail
**PRD says:** Sidebar navigation with 5 pages: Active Trades (`/`), Feed (`/feed`), Watchlist (`/watchlist`), Alerts (`/alerts`), Settings (`/settings`)
**Design says:** Single-page master-detail layout. Left panel (All Posts + ticker list) + right panel (contextual detail). No sidebar nav. No separate pages except Settings.
**Impact:** Section 6.1, 6.2, 6.3, 8.4 Layout, 12 Repository Structure, 13 Build Order

### 2. NAVIGATION: Sidebar → Left panel IS navigation
**PRD says:** "Sidebar navigation: Feed | Active Trades | Watchlist | Alerts | Settings"
**Design says:** Left panel with "All Posts" card at top, then "WATCHLIST" section label, then unified ticker cards. Quick Paste button pinned at bottom.
**Impact:** Section 8.4

### 3. WATCHLIST + ACTIVE TRADES: Separate views → Unified list
**PRD says:** Watchlist and Active Trades are separate views with different layouts and features.
**Design says:** Single ticker list in left panel. Whether something is "watchlist" vs "active trade" is just a status on the card. No visual separation — the flag icon only appears when there's an unread alert.
**Impact:** Section 6.2, 6.3, data model (may simplify)

### 4. FEED CARDS: Full metrics → Compact with smart add
**PRD says:** Feed cards show full chart, ticker, all parsed metrics (target, date, confidence), add/delete buttons.
**Design says:** Compact cards: chart (180px) + ticker + snippet (~80 chars) + smart add button with 3 states (Add/Update/Added). No metrics in feed view — metrics only show in ticker detail view.
**Impact:** Section 6.1

### 5. TICKER DETAIL: Card grid → Primary + history stack
**PRD says:** Trade cards in a grid layout with all data visible.
**Design says:** Latest post gets a "primary card" treatment (chart, metrics, sparkle, report footer). Older posts are subtle expandable rows below it (timestamp + view + delete only).
**Impact:** Section 6.3

### 6. LEFT PANEL CARDS: Multiple data points → Simplified
**PRD says:** Cards could show ticker + current price + status dot + P&L + sparkline.
**Design says:** Ticker (large) + current price (DM Mono) + ONE indicator: either "Confirmed ✓" or "X.X% away". No confidence %, no status dot, no P&L on cards.
**Impact:** Section 8.4

### 7. ALERTS: Banner + drawer → Flag + inline + toasts
**PRD says:** Persistent alert banner at top, global alert drawer (slide-out), unacknowledged counter in sidebar, dedicated `/alerts` page.
**Design says:**
- Flag icon on left panel card (only when unread alert — completely hidden otherwise)
- Inline alert in right panel (only when that ticker is selected)
- Toast notifications (top-right desktop, bottom mobile)
- No persistent top banner
- No alert drawer
- No `/alerts` page (v1)
- Dismissing inline alert clears the flag on the left card
**Impact:** Section 6.4

### 8. FEEDBACK: Flagging fields → Report link + action panel
**PRD says:** No feedback mechanism specified in this detail.
**Design says:** "Analysis not right? Report" link as a footer inside the primary card. Clicking opens a Report action panel (side panel desktop, bottom sheet mobile) with textarea for natural language feedback.
**Impact:** New feature, no PRD section exists

### 9. DELETE CONFIRMATION: Direct action → Action panel
**PRD says:** "Remove from Watchlist" with confirmation.
**Design says:** Trash icon in right panel header → opens Delete confirmation action panel with warning details (post count, what gets removed). Red destructive button.
**Impact:** Section 6.2

### 10. ACTION PANEL PATTERN: New reusable component
**PRD says:** Modals for Quick Paste, promote, close trade.
**Design says:** Reusable "Action Panel" pattern: side panel on desktop (400px, slides from right), bottom sheet on mobile (max 85vh, slides up). Used for Report, Delete. Future: Quick Paste, AI Explainability.
**Impact:** New pattern not in PRD. Quick Paste may use this instead of a centered modal.

### 11. MOBILE RESPONSIVE: Tab nav → Panel takeover
**PRD says:** "Mobile (<768px): Bottom tab navigation + single-column stack + FAB for Quick Paste"
**Design says:** Left panel is full-screen on load. Tapping a card slides the right panel in as a full takeover with "← Back" button. Metrics stack vertically. Toasts anchor to bottom. Action panels become bottom sheets. Report link centers. No bottom tab nav.
**Impact:** Section 8.7

### 12. BRANDING: Coach Tracker → Coachtrack
**PRD says:** "Coach Trade Tracker" throughout, with "@great_martis" visible.
**Design says:** "Coachtrack" (one word). Radar-inspired logo mark. No @great_martis text — replaced by subtle X icon that links to Coach's feed.
**Impact:** Throughout PRD, Section 8

### 13. DIRECTION-AWARE: Long-only → Long + Short support
**PRD says:** Confirmation logic mostly described for longs ("currentPrice >= priceConfirmation").
**Design says:** Shorts confirm when price drops BELOW confirmation level. Proximity % must calculate correctly for both directions. Coach's actual posts are heavily bearish (short setups).
**Impact:** Section 5.4 Price Monitor Agent, alert evaluation logic

### 14. SPARKLE / AI EXPLAINABILITY: New affordance
**PRD says:** Not specified.
**Design says:** ✦ sparkle icon next to confidence % on primary card. Clickable affordance for future AI explainability panel. Currently visual only.
**Impact:** New feature hook, no PRD section

### 15. QUICK PASTE: FAB → Left panel button + future action panel
**PRD says:** Floating Action Button (bottom-right corner, always visible) + keyboard shortcut.
**Design says:** Full-width button pinned at bottom of left panel: "+ Quick Paste". Will likely open as an action panel (side panel / bottom sheet) rather than a centered modal.
**Impact:** Section 6.5

---

## Sections That Need NO Changes

- Section 1-3: Executive Summary, Problem Statement, Personas (minor name update only)
- Section 4: Technical Architecture, Data Model (no schema changes needed — the unified list is a UI concern, not a data model concern)
- Section 5.1-5.3: Orchestration, Ingestion, Parser agents (unchanged)
- Section 5.5-5.10: Notification, Architect, QA, Ops, Frontend, Security agents (unchanged except Frontend's design system ownership)
- Section 7: API Routes (unchanged — the APIs serve both layouts)
- Section 9: Dual-Track Design Workflow (validated by this exact process)
- Section 10-11: Milestones, Environment Variables (unchanged)
- Section 14-15: Appendix, Glossary (minor updates)

---

## Claude Code Instructions

### Prompt 1: Update the PRD

```
Read docs/prd.md and the handoff spec at docs/handoffs/001-master-detail-dashboard.md.

Update docs/prd.md with the following changes. Preserve all content that is NOT being changed — only modify the sections listed below.

1. GLOBAL: Replace "Coach Trade Tracker" with "Coachtrack" throughout (title, headers, references). Replace "Coach Tracker" with "Coachtrack".

2. SECTION 6 — Replace sections 6.1, 6.2, and 6.3 entirely with:
   - 6.1 Master-Detail Layout (the single-page layout described in the handoff spec)
   - 6.2 Left Panel (All Posts card, unified ticker list, Quick Paste button)
   - 6.3 Right Panel — All Posts View (compact cards with smart add buttons)
   - 6.4 Right Panel — Ticker Detail View (primary card, older posts, report footer)
   Refer to the handoff spec for exact requirements.

3. SECTION 6.4 (old Alert System) → Renumber to 6.5 and update:
   - Remove: persistent top banner, global alert drawer, sidebar badge, /alerts page
   - Add: flag icon on left panel cards (only when unread), inline alert in right panel, toast notifications (top-right desktop, bottom mobile)

4. SECTION 6.5 (old Quick Paste) → Renumber to 6.6 and update:
   - Replace "Floating Action Button" with "full-width button pinned at bottom of left panel"
   - Note that Quick Paste will open as an action panel (side panel desktop / bottom sheet mobile) rather than a centered modal
   - Remove "Menu bar item" trigger

5. ADD new section 6.7: Action Panel Pattern
   Describe the reusable pattern from the handoff spec: side panel on desktop, bottom sheet on mobile. List current uses (Report, Delete) and future uses (Quick Paste, AI Explainability).

6. ADD new section 6.8: Report Feedback
   Describe the "Analysis not right? Report" flow from the handoff spec.

7. SECTION 8.4 Layout: Replace the ASCII layout diagram and description with the master-detail layout from the handoff spec. Remove all sidebar navigation references.

8. SECTION 8.5 Component Style Guide: Add Action Panel component pattern. Update Trade Card to reflect Primary Post Card pattern.

9. SECTION 8.7 Responsive: Replace with the mobile panel-takeover pattern from the handoff spec. Remove "Bottom tab navigation" reference.

10. SECTION 5.4 Price Monitor Agent: Add direction-aware confirmation logic. For shorts: currentPrice <= priceConfirmation. For longs: currentPrice >= priceConfirmation. Note Coach's style is heavily chart-based with bearish/short setups.

11. SECTION 12 Repository Structure: Replace the file tree with the structure from the handoff spec. Remove /feed, /watchlist, /alerts page routes. Add left-panel/, right-panel/, action-panels/ component directories.

12. SECTION 13 Build Order: Update to reflect new component structure:
    0. Design system + globals.css
    1. Prisma schema + migration
    2. Primitives (PriceBadge, ProximityBadge, SmartAddButton, etc.)
    3. Layout shell (LeftPanel + RightPanel + ActionPanel)
    4. Left panel (LogoHeader, AllPostsCard, TickerCard)
    5. Right panel — All Posts view (AllPostsFeed with smart add)
    6. Right panel — Ticker Detail (PrimaryPostCard, OlderPostRow)
    7. Quick Paste (action panel)
    8. NLP Parser + Image Analyzer
    9. Price integration + live updates
    10. Alert system (flags, inline, toasts)
    11. Action panels (Report, Delete)
```

### Prompt 2: Update CLAUDE.md

```
Read the updated docs/prd.md and docs/handoffs/001-master-detail-dashboard.md.

Update CLAUDE.md to reflect the new layout:

1. Replace "Architecture" section diagram to show single-page master-detail layout instead of multi-page routes.

2. Update "Design" section rule 5 to list the new primitives: PriceBadge, ProximityBadge, SmartAddButton, ConfidenceBadge (with sparkle), ShimmerLoader.

3. Update "Build Order" to match the new sequence from the PRD update.

4. Add to "Critical Rules":
   - "The app is ONE route (/). No separate pages for feed, watchlist, or alerts."
   - "Watchlist and active trades are a unified list. Status is a property on the ticker, not a separate view."
   - "Confirmation logic is direction-aware: shorts confirm below, longs confirm above."

5. Update "Gotchas":
   - "Coach's posts are heavily chart-based with bearish/short setups. The parser and proximity calculations must handle short direction."
```

### Prompt 3: Update design-system.md

```
Read docs/design-system.md and add the following new component patterns:

1. Action Panel (desktop side panel + mobile bottom sheet)
2. Primary Post Card (latest post with metrics, report footer)
3. Older Post Row (subtle, expandable)
4. Smart Add Button (3 states: add, update, added)
5. Proximity Badge (Confirmed ✓ or X.X% away, direction-aware)
6. Report Footer (card footer with link, centered on mobile)
7. Logo Header (radar mark + Coachtrack + X link)

Update the existing component patterns:
- Trade Card → rename to Ticker Card (left panel) with new specs
- Remove references to colored left borders on cards
- Update Status Badge to reflect flag-only-on-alert pattern

Increment version to 1.1.0 and add changelog entry.
```

### Prompt 4: Copy handoff spec and prototype

```
Copy the handoff spec to the project:
- Save docs/handoffs/001-master-detail-dashboard.md (the file I just created)
- Save the prototype as docs/prototypes/dashboard-v12.jsx for reference

These are reference documents — Claude Code should read them but not deploy them as application code.
```
