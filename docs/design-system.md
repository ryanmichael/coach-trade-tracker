# Coachtrack — Design System
# Aesthetic: Mercury Bank Dark Mode

## Last Updated: 2026-03-12
## Version: 1.3.0

---

## Brand Reference
Inspired by Mercury Bank (https://demo.mercury.com/dashboard).
Mercury's design principles adapted to dark mode: calm over urgency,
semantic color tokens, monochrome-first with selective accent,
generous whitespace, typography-driven hierarchy, subtle borders.

**App name:** Coachtrack (one word, capital C).
**Logo:** Radar-inspired geometric icon — indigo rounded square (#7C7CFF, border-radius 7px)
containing concentric arcs radiating from bottom-left with a diagonal sweep line and a
single bright "blip" dot. 28×28px.

See PRD Section 8 for full brand & design philosophy.

---

## Design Tokens

### Colors — Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#111113` | Page-level background |
| `--bg-surface` | `#18181B` | Cards, panels |
| `--bg-surface-hover` | `#1F1F23` | Card hover |
| `--bg-elevated` | `#26262B` | Modals, dropdowns |
| `--bg-overlay` | `rgba(0,0,0,0.6)` | Backdrop behind modals |
| `--bg-input` | `#18181B` | Input backgrounds |
| `--bg-input-focus` | `#1F1F23` | Input focused |

### Colors — Text
| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#ECECEF` | Primary content |
| `--text-secondary` | `#A0A0AB` | Labels, descriptions |
| `--text-tertiary` | `#63636E` | Disabled, placeholders |
| `--text-inverse` | `#111113` | Text on colored badges |

### Colors — Borders
| Token | Value | Usage |
|-------|-------|-------|
| `--border-default` | `rgba(255,255,255,0.08)` | Cards, dividers |
| `--border-subtle` | `rgba(255,255,255,0.04)` | Faint structural lines |
| `--border-strong` | `rgba(255,255,255,0.15)` | Inputs, focus rings |
| `--border-focus` | `#7C7CFF` | Focus ring accent |

### Colors — Accent
| Token | Value | Usage |
|-------|-------|-------|
| `--accent-primary` | `#7C7CFF` | Links, active nav, primary buttons |
| `--accent-primary-hover` | `#9B9BFF` | Hover state |
| `--accent-muted` | `rgba(124,124,255,0.12)` | Selected card background |

### Colors — Semantic (trading data ONLY)
| Token | Value | Usage |
|-------|-------|-------|
| `--semantic-positive` | `#3FCF8E` | Bullish, profit, confirmation |
| `--semantic-negative` | `#F06E6E` | Bearish, loss, stop loss |
| `--semantic-warning` | `#F0B85F` | Pending, warnings |
| `--semantic-info` | `#6EB0F0` | New post, informational |
| `--semantic-positive-muted` | `rgba(63,207,142,0.12)` | Positive badge bg |
| `--semantic-negative-muted` | `rgba(240,110,110,0.12)` | Negative badge bg |
| `--semantic-warning-muted` | `rgba(240,184,95,0.12)` | Warning badge bg |
| `--semantic-info-muted` | `rgba(110,176,240,0.12)` | Info badge bg |

Rule: semantic colors appear ONLY on price numbers, P&L, status
badges, progress bar fills, alert accents. Never as card/section fills.

### Typography
| Role | Font | Weight | Size | Tracking | Usage |
|------|------|--------|------|----------|-------|
| Financial Data | DM Mono | 400 | 14–24px | 0 | Prices, P&L, dollar amounts |
| Page Titles | DM Sans | 500 | 24px | -0.02em | "All Posts", section headers |
| Section Headers | DM Sans | 500 | 16px | -0.01em | Card titles, right panel header |
| Body | DM Sans | 400 | 14px | 0 | Post text, descriptions |
| Labels | DM Sans | 500 | 12px | 0.04em, uppercase | Form labels, badges, section labels |
| Small / Captions | DM Sans | 400 | 12px | 0 | Timestamps, subtitles |
| Ticker Symbols | DM Sans | 600 | 16px | 0.02em, uppercase | AAPL, TSLA (left panel cards) |
| App Name | DM Sans | 600 | 15px | 0 | "Coachtrack" in header |

Rule: Numbers are ALWAYS DM Mono. Max weight is 500 (no bold/700) except ticker symbols (600) and app name (600).

### Spacing
| Token | Value |
|-------|-------|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-10` | `40px` |
| `--space-12` | `48px` |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Badges |
| `--radius-md` | `8px` | Cards, inputs, buttons |
| `--radius-lg` | `12px` | Action panels (bottom sheet top corners) |

### Shadows
| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elevation |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | Dropdowns |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | Action panels |

### Animation
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | `120ms` | Hover states |
| `--duration-normal` | `200ms` | State transitions |
| `--duration-slow` | `350ms` | Action panel slide in/out, shimmer |
| `--ease-default` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | General |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entry animations |

---

## Component Patterns

### Ticker Card (left panel)
Used in the left panel unified ticker list (watchlist + active trades combined).
- Background: `--bg-surface`, hover: `--bg-surface-hover`
- Border: 1px `--border-default`, radius `--radius-md`
- Padding: `--space-3` vertical, `--space-4` horizontal
- Selected: border `--accent-primary`, background `--accent-muted`, ticker text `--accent-primary`
- No colored left border. No status dot. No P&L on card.
- **Ticker:** DM Sans 16px 600, uppercase
- **Price:** DM Mono 14px, `--text-primary`
- **Proximity indicator:** ONE of: Confirmed ✓ badge (positive-muted) OR X.X% away badge (color-scaled)
- **Alert flag column:** Rendered ONLY when unread alert exists. Left-side column with flag icon, pulsing green, `--semantic-positive-muted` background. Card layout changes — not just visibility toggled.

### Primary Post Card (ticker detail, latest post)
The featured card in the right panel ticker detail view.
- Background: `--bg-surface`, border: 1px `--border-default`, radius `--radius-md`
- Chart image: 180px height placeholder, `--bg-elevated` background
- "Latest" label: 11px, uppercase, `--accent-primary`
- Metrics row: 3 columns (Target | Date | Confidence) separated by `--border-subtle` vertical dividers
- Confidence column includes ✦ sparkle icon — visual affordance only in v1, future AI explainability hook
- Report footer: INSIDE card, 14px margin-top from metrics, 1px `--border-subtle` divider, 5px vertical padding. Text: "Analysis not right? **Report**" — "Report" in `--accent-primary`.

### Older Post Row
Minimal expandable row for older posts below the primary card.
- Border: 1px `--border-subtle`, brightens to `--border-default` on hover
- Padding: tight, 6px gap between rows
- Content: clock icon + timestamp + "View" button (ghost) + trash icon
- No chart, no ticker name, no metrics
- "View" expands inline to show raw post text

### Action Panel (desktop: side panel, mobile: bottom sheet)
Reusable pattern for focused interactions (Report, Delete, Quick Paste).
- **Desktop:** Fixed right: 0, full height. 400px wide (max-width 90vw). Slides from right (350ms `--ease-out`). Background: `--bg-surface`. Border-left: 1px `--border-default`. Shadow: `--shadow-lg`. Overlay: `--bg-overlay`.
- **Mobile:** Fixed bottom: 0, full width. Max-height: 85vh. Slides up (350ms `--ease-out`). Rounded top corners: `--radius-lg`. Drag handle: 32px × 4px centered, `--border-strong` color.
- **Structure:** Header (title + description + ✕ close) with border-bottom `--border-default`; Body (scrollable, 20px padding); Footer (Cancel + primary action) with border-top `--border-default`.
- Overlay, ✕, or Cancel all dismiss.

### Smart Add Button (3 states)
Used on All Posts feed cards to show watchlist relationship.
- **"+ Add to Watchlist":** Secondary style. `--border-strong` border, `--text-primary` text, transparent bg.
- **"Update Watchlist":** Accent fill. `--accent-muted` bg, `--accent-primary` border and text.
- **"✓ Added":** Read-only badge. `--semantic-positive-muted` bg, `--semantic-positive` text. Not clickable.

### Proximity Badge (direction-aware)
Shows how close current price is to the confirmation level.
- **"Confirmed ✓":** `--semantic-positive-muted` bg, `--semantic-positive` text. Shown when price has passed confirmation.
- **"X.X% away":** Color scales from `--semantic-negative` (far away) → `--semantic-warning` (getting close) → `--semantic-positive` (nearly there).
- Direction-aware: shorts confirm when price ≤ confirmation; longs confirm when price ≥ confirmation.
- Label typography (12px, 500, uppercase), `--radius-sm`.

### Confidence Badge (with sparkle)
Shows parser confidence % on the Primary Post Card metrics row.
- DM Mono 14px for the number
- ✦ sparkle icon (accent color, 12px) to the right of the number
- Sparkle is clickable affordance (no action in v1 — future AI explainability panel)

### Report Footer
Footer inside the Primary Post Card.
- Separated from metrics by 14px margin + 1px `--border-subtle` divider
- 5px top/bottom padding
- Text: "Analysis not right? **Report**" — regular `--text-tertiary` + bold link in `--accent-primary`
- After submission: replaced by "✓ Feedback saved" in `--semantic-positive`, auto-clears after 3s
- Centered on mobile, left-aligned on desktop

### Logo Header
Left panel header.
- Radar mark SVG (28×28) + "Coachtrack" text (15px, 600)
- X feed icon (dark gray `#3A3A42`) at far right — brightens on hover, opens Coach's X feed in new tab
- No @username text visible

### Quick Paste Modal
Now opens as an action panel (not a centered modal).
- Desktop: side panel (400px)
- Mobile: bottom sheet (max 85vh)
- Two zones inside: text textarea + image drop zone
- Parsed fields: editable inputs with source indicators (📝/📊/🔗)
- Shimmer: gentle gradient sweep on fields awaiting image analysis

### Ticker Badge
- Pill-shaped, `--radius-sm`
- Background: `--accent-muted`
- Text: `--accent-primary`, label typography

### Alert Toast
- **Desktop:** Top-right (16px inset), slides in from right
- **Mobile:** Bottom (16px inset), slides up, full-width, stack newest at bottom
- `--bg-surface` background, 3px left accent colored by alert type
- Auto-dismiss: 10 seconds, pause on hover

### Status Badge
- PENDING: `--semantic-warning-muted` bg, `--semantic-warning` text
- CONFIRMED: `--semantic-positive-muted` bg, `--semantic-positive` text
- ENTERED: `--accent-muted` bg, `--accent-primary` text
- CLOSED: `--bg-elevated` bg, `--text-tertiary` text

### Trade Summary Chart
SVG line chart rendered from structured ChartData. Replaces the chart placeholder in the Primary Post Card. Every chart follows the same visual language regardless of Coach's source screenshot.

- **Container:** Rendered inside the Primary Post Card's chart area. No border or background — inherits from the card. 16px padding on all sides.
- **SVG:** `viewBox="0 0 540 260"`, `width: 100%`, responsive.
- **Padding:** top: 20px, right: 60px (Y-axis labels), bottom: 30px (X-axis), left: 50px.

#### Visual Layers (back to front)

| Layer | Element | Color | Weight | Opacity | Notes |
|-------|---------|-------|--------|---------|-------|
| 1 | Y-axis grid | `rgba(255,255,255,0.04)` | 0.5px | — | 5–6 horizontal lines |
| 2 | Time window band | `--accent-primary` | fill | 4% | Full chart height, dashed vertical edges at 20% |
| 3 | Target zone fill | `--semantic-positive` | fill | 7% | Constrained to time window if present |
| 4a | Target lines | `--semantic-positive` | 0.5px | 40% | Dashed `4,4` |
| 4b | Confirmation line | `--semantic-warning` | 0.75px | 50% | Dashed `6,3` |
| 4c | Stop loss line | `--semantic-negative` | 0.75px | 45% | Dashed `3,3` |
| 5 | Price area fill | `--accent-primary` gradient | — | 12% → 0% | LinearGradient top to bottom |
| 6 | Price line | `--accent-primary` | 1.5px | 100% | Solid, round joins/caps |
| 7 | Projected line | `--accent-primary` | 1px | 35% | Dashed `4,4` |
| 8 | Current price dot | `--accent-primary` | 3.5px r | 100% | 2px `--bg-surface` stroke |
| 9 | Price badge | `--accent-primary` fill | — | 90% | DM Mono, `--text-inverse` text |
| 10 | Level labels | Same as line color | 9px | 100% | Weight 500, uppercase, 0.04em tracking |
| 11 | Time window pill | `--accent-primary` 12% fill | 9px | 100% | `--accent-primary-hover` text |
| 12 | Duration text | `--text-tertiary` | 9px | 100% | Centered below time band |
| 13 | Y-axis labels | `--text-tertiary` | DM Mono 10px | 100% | Right-aligned outside chart area |
| 14 | X-axis labels | `--text-tertiary` | DM Sans 10px | 100% | Center-aligned below chart |

#### Level Line Styles

| Level | Color Token | Stroke | Dash | Opacity | Label Position |
|-------|-------------|--------|------|---------|----------------|
| Target | `--semantic-positive` | 0.5px | `4,4` | 40% | Above line, left-aligned |
| Confirmation | `--semantic-warning` | 0.75px | `6,3` | 50% | Above line, left-aligned |
| Stop loss | `--semantic-negative` | 0.75px | `3,3` | 45% | Below line (long) / above line (short), left-aligned |

#### Time Window Overlay

Vertical band indicating the expected time range for the target price to be reached.

- **Band:** `--accent-primary` at 4% opacity, full chart height, rounded corners (3px)
- **Edge lines:** `--accent-primary` at 20% opacity, 0.5px, dashed `3,4`
- **Top pill:** Centered at top of band. `--accent-primary` 12% fill, 3px radius, 88px wide, 16px tall. Text: 9px, weight 500, `--accent-primary-hover` color.
- **Duration label:** Centered below the band at the X-axis. 9px, `--text-tertiary`.
- **Target zone intersection:** When both time window and target zone exist, the green target fill is constrained to the time window's X range.

#### Legend

Rendered in HTML below the SVG. Conditional — only shows items with data.

```
● Price  ╌ Projected  ● Target zone  ● Confirmation  ● Stop
```

- Dots: 6×6px circles
- Dash: 14px dashed line, 0.6 opacity
- Labels: 10px, `--text-tertiary`, DM Sans

---

## Changelog
| Version | Date | Changes |
|---------|------|---------|
| 1.3.0 | 2026-03-12 | Trade Summary Chart: SVG line chart component replacing chart placeholder in Primary Post Card. Layers spec (grid, time window, target zone, level lines, price line, projected path, current price dot). Time Window Overlay pattern (vertical band + pill + duration label + target zone intersection). Level Line Styles table (target/confirmation/stop with distinct dash patterns and colors). Legend pattern (HTML footer, conditional items). |
| 1.1.0 | 2026-03-12 | Master-detail layout patterns: Action Panel, Primary Post Card, Older Post Row, Smart Add Button, Proximity Badge, Confidence Badge (sparkle), Report Footer, Logo Header. Renamed Trade Card → Ticker Card with new left-panel specs. Removed colored left borders from cards. Updated alert pattern (flag+inline+toast, no persistent banner). App renamed to Coachtrack. |
| 1.0.0 | 2026-03-11 | Initial design system — Mercury Dark Mode |
