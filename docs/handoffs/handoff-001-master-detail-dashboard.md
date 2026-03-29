# UI Handoff: Master-Detail Dashboard (v12)

## Status: Ready for Build
## Priority: P0 — This replaces the original multi-page layout from the PRD
## Design System Version: 1.0.0
## Prototype Reference: dashboard-v12.jsx

---

## Overview

The prototype sessions resulted in a **fundamental layout change** from the original PRD. Instead of separate pages for Feed, Watchlist, and Active Trades with a sidebar navigation, the app uses a **single-page master-detail layout** where:

- The **left panel** contains All Posts + a unified ticker list (watchlist and active trades combined)
- The **right panel** shows contextual detail based on what's selected in the left panel
- **Action panels** (side panel on desktop, bottom sheet on mobile) handle focused interactions like Report and Delete

This is a simpler, faster UX that keeps the user in one context.

---

## Branding

- **App name:** "Coachtrack" (one word, capital C)
- **Logo mark:** Radar-inspired geometric icon — indigo rounded square (#7C7CFF, border-radius 7px) containing concentric arcs radiating from bottom-left with a diagonal sweep line and a single bright "blip" dot. See SVG in prototype.
- **X feed link:** Subtle X (Twitter) logo icon in dark gray (#3A3A42), positioned at far right of header. Opens `https://x.com/great_martis/superfollows` in new tab. Brightens on hover.
- **No `@great_martis` text visible** — the X icon is the only reference to Coach's identity.

---

## Layout Structure

### Desktop (≥768px)
```
┌──────────────────────────────────────────────────────────┐
│ [Logo] Coachtrack                              [X icon]  │ ← Left panel header
├──────────┬───────────────────────────────────────────────┤
│          │                                               │
│ All Posts│  TICKER  $XX.XX  [Confirmed ✓]     [trash]   │ ← Right panel header
│          │  N posts · Status                             │
│ ──────── │                                               │
│ WATCHLIST│  ┌─────────────────────────────────────────┐  │
│          │  │ Primary Card (latest post)              │  │
│ MAGS ... │  │ Chart + Metrics + Report footer         │  │
│ RUT  ... │  └─────────────────────────────────────────┘  │
│ SOX  ... │  Analysis not right? Report                   │
│ SOXS ... │                                               │
│          │  Previous posts (N)                           │
│          │  ┌─ time · View · 🗑 ──────────────────────┐  │
│          │  ┌─ time · View · 🗑 ──────────────────────┐  │
│          │                                               │
├──────────┤                                               │
│[+QuickPaste]                                             │
└──────────┴───────────────────────────────────────────────┘
```

- Left panel: fixed 290px width
- Right panel: flex 1, scrollable
- No sidebar navigation — the left panel IS the navigation

### Mobile (<768px)
- Left panel takes full screen on load
- Tapping a card slides the right panel in from the right (full takeover)
- "← Back" button at top of detail view returns to left panel
- Metrics stack vertically
- Action panels become bottom sheets
- Toasts anchor to bottom
- Report link centers

---

## Left Panel Components

### Header
- Logo mark (28x28) + "Coachtrack" text (15px, weight 600)
- X feed icon on far right (dark gray, hover brightens)

### All Posts Card
- Simple card: "All Posts" title + post count subtitle
- No flag column, no icons
- Selected state: indigo border + accent-muted background

### Ticker Cards (unified — watchlist + active trades in one list)
- **"WATCHLIST" section label** above the cards (11px, uppercase, tertiary)
- Each card shows:
  - Ticker symbol: 16px, weight 600
  - Current price: DM Mono 14px, primary color
  - **ONE indicator** (mutually exclusive):
    - "Confirmed ✓" — green muted badge (when price has reached confirmation)
    - "X.X% away" — colored badge showing distance to confirmation (red → amber → green)
  - No confidence % on cards
- **Direction-aware proximity:** For shorts, confirmation triggers when price drops BELOW the level. For longs, when price rises ABOVE.
- **Alert flag:** A flag icon column appears on the LEFT side of a card ONLY when there is an unread alert. Pulsing green with green muted background. Flag column is completely hidden (not rendered) on cards without alerts.
- Selected state: indigo border + accent-muted background, ticker text turns accent color.

### Quick Paste Button
- Pinned at bottom of left panel, above border
- Full-width indigo button: "+ Quick Paste"
- Opens Quick Paste action panel (future build)

---

## Right Panel — All Posts View

When "All Posts" is selected in the left panel:

### Header
- "All Posts" title (20px, weight 500)
- Post count subtitle (12px, tertiary)
- No trash button in this view

### Post Cards
Each post is a compact card showing:
- **Chart image placeholder** (180px height, bg-elevated background)
- **Ticker** (15px, weight 600) + **timestamp** (12px, tertiary)
- **Snippet** (~80 characters of post text, truncated with "...")
- **Smart add button** with 3 states:
  - **"+ Add to Watchlist"** — outlined button (border-strong). Shown when ticker is NOT on watchlist.
  - **"Update Watchlist"** — indigo accent fill (accent-muted bg, accent border). Shown when ticker IS on watchlist but this post is NEWER than the tracked post.
  - **"✓ Added"** — green muted badge, not clickable. Shown when this post is already tracked or an even newer post is tracked.
- **Delete button** (small ✕) on the right side of the button row

---

## Right Panel — Ticker Detail View

When a ticker card is selected in the left panel:

### Header
- Ticker symbol (20px, weight 500) + current price (DM Mono 14px)
- Proximity badge: "Confirmed ✓" or "X.X% away" (same as left panel card)
- Post count + status subtitle ("2 posts · Active trade" or "1 post · Watching")
- **Trash icon button** (top-right) — opens delete confirmation action panel

### Inline Alert (conditional)
- Shown ONLY when this ticker has an active unacknowledged alert
- Colored border + background matching alert type
- Icon + label + message + "Dismiss" button
- Dismissing clears the alert AND removes the flag from the left panel card

### Primary Post Card (latest)
- **Chart image placeholder** (180px height)
- **"Latest" label** (11px, uppercase, accent color) + timestamp
- **"Show/Hide" toggle** for raw post text
- **"+ Update" button** — for pasting a new Coach post for this ticker
- **Metrics row** with 3 columns separated by borders:
  - Target: price + percentage (DM Mono)
  - Date: projected date
  - Confidence: percentage + **✦ sparkle icon** (clickable, for future AI explainability)
- **Report footer** (inside card, at bottom):
  - Separated from metrics by 14px margin + subtle divider
  - Text: "Analysis not right? **Report**" (Report is accent-colored link)
  - Clicking Report opens the Report action panel
  - After submission: "✓ Feedback saved" (green, auto-clears after 3s)
  - Centered on mobile, left-aligned on desktop
  - Compact: 5px top/bottom padding

### Older Posts (subtle, below primary card)
- **"Previous posts (N)" section label** (11px, uppercase, tertiary)
- Each older post is a minimal row:
  - Clock icon + timestamp + "View" button + trash icon
  - No chart, no ticker name, no metrics
  - "View" expands to show raw post text content
  - Subtle border (border-subtle), brightens on hover
  - Tight 6px gap between rows

---

## Action Panel Pattern (reusable)

A shared interaction pattern for focused inputs. Used for Report and Delete today, Quick Paste and AI Explainability in the future.

### Desktop: Side Panel
- Fixed position, right: 0, full height
- 400px wide, max-width 90vw
- Slides in from right (animation: 350ms ease)
- bg-surface background, border-left, shadow-lg
- Overlay dims the rest of the app (bg-overlay)

### Mobile: Bottom Sheet
- Fixed position, bottom: 0, full width
- Max-height: 85vh
- Slides up from bottom (animation: 350ms ease)
- Rounded top corners (radius-lg)
- Drag handle bar at top (32px × 4px, border-strong color)
- Overlay behind

### Shared Structure
- **Header:** Title + description + ✕ close button. border-bottom.
- **Body:** Scrollable content area. 20px padding.
- **Footer:** Action buttons (Cancel secondary + primary action). border-top.
- Clicking overlay or ✕ or Cancel all dismiss the panel.

### Report Panel Content
- Header: "Report Issue" / "Help improve how the system interprets Coach's posts"
- Body: textarea with placeholder, helper text about training
- Footer: Cancel + "Submit Report" (accent-primary, disabled until text entered)

### Delete Panel Content
- Header: "Remove {TICKER} from Watchlist" / "This action can't be undone"
- Body: Red warning box with details (post count, what gets removed)
- Footer: Cancel + "Remove {TICKER}" (semantic-negative background, white text)

---

## Toast Notifications

- **Desktop:** Fixed top-right (16px inset), slide in from right
- **Mobile:** Fixed bottom (16px inset), slide up from bottom, full-width, stack newest at bottom
- Structure: colored accent bar (3px left) + icon badge + label + message + ✕ dismiss
- 4 types: confirmation (green), target (amber), stop loss (red), new post (blue)
- Auto-dismiss after 10 seconds (not implemented in prototype yet)

---

## File Structure for Claude Code

```
apps/web/
├── app/
│   └── (dashboard)/
│       ├── layout.tsx          # Just wraps children, no sidebar nav
│       └── page.tsx            # The entire master-detail layout
├── components/
│   ├── layout/
│   │   ├── LeftPanel.tsx       # Header + AllPosts card + ticker list + QuickPaste button
│   │   ├── RightPanel.tsx      # Header + conditional content (AllPosts vs TickerDetail)
│   │   └── ActionPanel.tsx     # Reusable side panel (desktop) / bottom sheet (mobile)
│   ├── left-panel/
│   │   ├── LogoHeader.tsx      # Radar mark + Coachtrack + X link
│   │   ├── AllPostsCard.tsx    # Simple card for "All Posts"
│   │   └── TickerCard.tsx      # Ticker + price + confirmed/% away + optional flag
│   ├── right-panel/
│   │   ├── AllPostsFeed.tsx    # List of compact post cards with smart add buttons
│   │   ├── TickerDetail.tsx    # Primary card + report + older posts
│   │   ├── PrimaryPostCard.tsx # Chart + Latest label + metrics + report footer
│   │   ├── OlderPostRow.tsx    # Minimal expandable row
│   │   └── InlineAlert.tsx     # Conditional alert banner in detail view
│   ├── action-panels/
│   │   ├── ReportPanel.tsx     # Report feedback content
│   │   └── DeletePanel.tsx     # Delete confirmation content
│   ├── alerts/
│   │   └── ToastContainer.tsx  # Toast notifications (position-aware)
│   └── primitives/
│       ├── PriceBadge.tsx
│       ├── ConfidenceBadge.tsx # With sparkle icon
│       ├── ProximityBadge.tsx  # Confirmed ✓ or X.X% away
│       ├── SmartAddButton.tsx  # 3-state: add/update/added
│       └── ShimmerLoader.tsx
├── hooks/
│   ├── useWindowWidth.ts       # Window resize tracking
│   ├── useIsMobile.ts          # Breakpoint hook (768px)
│   └── useActionPanel.ts       # Open/close state for action panels
└── stores/
    ├── selection.ts            # selected ticker + mobileShowDetail state
    ├── watchlist.ts            # Watchlist with tracked post IDs
    ├── alerts.ts               # Unread alerts + ticker alerts
    └── feed.ts                 # Posts data
```

---

## Key Implementation Notes

- The entire app is ONE route (`/`). No `/feed`, `/watchlist`, `/alerts`, or `/settings` pages.
- `selected` state drives everything: `"all"` shows the feed, a ticker symbol shows that ticker's detail.
- Watchlist tracks `ticker → postId` (which post was added). This drives the 3-state smart add button.
- Proximity calculations must be direction-aware: shorts confirm when price drops BELOW, longs confirm when price rises ABOVE.
- The flag column on left panel cards should not render at all (not just hidden) when there's no alert. The card layout changes between having and not having the flag column.
- Quick Paste button is always visible at the bottom of the left panel, not a FAB.
- The report footer sits INSIDE the primary card with 14px margin-top from the metrics and 5px vertical padding. The content wrapper above it has 0 bottom padding.
