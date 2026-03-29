# Coachtrack

A single-user trading dashboard that transforms a paid X subscription coach's posts into structured, actionable trade data with real-time price alerts.

## Docs — Read Before Building

- Full PRD with architecture, schema, agents, features: @docs/prd.md
- Design system tokens, typography, component patterns: @docs/design-system.md
- Component handoff specs from design sessions: @docs/handoffs/

IMPORTANT: Read `docs/design-system.md` before building ANY component. Read `docs/prd.md` Section 4.3 for the Prisma schema and Section 7 for API routes.

## Tech Stack

- **Framework:** Next.js 14+ (App Router), TypeScript
- **Database:** PostgreSQL via Supabase, Prisma ORM
- **State:** Zustand
- **UI:** Tailwind CSS + shadcn/ui + DM Sans/DM Mono fonts
- **Prices:** Polygon.io (REST polling v1, WebSocket v2)
- **Jobs:** BullMQ + Redis
- **AI Parsing:** Regex pipeline (fast) + Claude Vision API (images) + Claude Sonnet (text fallback)
- **Monorepo:** Turborepo

## Architecture

Single-page master-detail layout. One route (`/`). Left panel IS the navigation.

```
apps/web/
  app/(dashboard)/
    layout.tsx   → wraps children, no sidebar nav
    page.tsx     → the entire master-detail layout (left + right panel)
  components/
    layout/      → LeftPanel, RightPanel, ActionPanel
    left-panel/  → LogoHeader, AllPostsCard, TickerCard
    right-panel/ → AllPostsFeed, TickerDetail, PrimaryPostCard, OlderPostRow, InlineAlert
    action-panels/ → ReportPanel, DeletePanel
    primitives/  → PriceBadge, ProximityBadge, SmartAddButton, ConfidenceBadge, etc.
  stores/
    selection.ts → selected ticker + mobileShowDetail
    watchlist.ts → watchlist with tracked post IDs
    alerts.ts    → unread alerts + ticker alerts
    feed.ts      → posts data

packages/agents/   → Backend logic (parser, price monitor, orchestrator, notifier)
packages/db/       → Prisma schema + migrations
packages/shared/   → TypeScript types, Zod validators, constants
docs/              → PRD, design system, component handoff specs
```

## Design — Mercury Dark Mode

The UI follows Mercury Bank's design language adapted to dark mode. Core rules:

1. **Calm over urgency** — no neon, no visual noise, generous whitespace
2. **Monochrome-first** — 90% grayscale. Trading colors (green/red) ONLY on price numbers, P&L, status badges, progress bars. Never as card backgrounds.
3. **Semantic tokens** — ALL colors use CSS variables from `design-system.md`. Zero hardcoded hex values.
4. **Typography hierarchy** — font weight + size create hierarchy, not color. Max weight is 500 (no bold/700). Numbers always use `DM Mono`.
5. **Compose from primitives** — build cards from shared primitives: `PriceBadge`, `ProximityBadge`, `SmartAddButton`, `ConfidenceBadge` (with sparkle ✦), `ShimmerLoader`, `StatusChip`, `ProgressBar`, `SourceIndicator`

## Commands

```bash
# Dev
cd apps/web && npm run dev              # Start Next.js dev server
npx prisma studio                       # Open Prisma DB browser
npx prisma migrate dev --name <name>    # Run migration

# Test
npm run test                            # Unit tests
npm run test:parser                     # Parser fixture tests
npx playwright test                     # E2E tests

# Build
npm run build                           # Production build
npm run lint                            # Lint check
npx tsc --noEmit                        # Type check
```

## Build Order

Build in this sequence — each step depends on the previous:

0. Design system + `globals.css` with CSS custom properties
1. Prisma schema + database migration
2. Primitives: `PriceBadge`, `ProximityBadge`, `SmartAddButton`, `ConfidenceBadge` (sparkle), `StatusChip`, `ShimmerLoader`, etc.
3. Layout shell: `LeftPanel` + `RightPanel` + `ActionPanel`
4. Left panel: `LogoHeader`, `AllPostsCard`, `TickerCard`
5. Right panel — All Posts view: `AllPostsFeed` with smart add
6. Right panel — Ticker Detail: `PrimaryPostCard`, `OlderPostRow`
7. Quick Paste (action panel)
8. NLP Parser + Image Analyzer
9. Price integration + live updates
10. Alert system (flags, inline, toasts)
11. Action panels (Report, Delete)

## Critical Rules

- IMPORTANT: The app is ONE route (`/`). No separate pages for feed, watchlist, or alerts.
- IMPORTANT: Watchlist and active trades are a unified list. Status is a property on the ticker, not a separate view.
- IMPORTANT: Confirmation logic is direction-aware: shorts confirm when price drops BELOW confirmation level, longs confirm when price rises ABOVE.
- IMPORTANT: Quick Paste is the #1 feature. It must feel instant for text (<100ms regex), progressive for images (1-3s Vision API with shimmer). Opens as an action panel (side panel on desktop, bottom sheet on mobile).
- IMPORTANT: Pre-population is non-negotiable. When user clicks "+Watchlist" or "+Active", EVERY parsed field carries into the new record. Zero re-typing.
- All parsed data is editable — the parser is a helper, not an authority.
- "Coach's latest" is a runtime query, not a stored field. Always fetch the most recent CoachPost for a ticker.
- No business logic in components. Data in Zustand stores, API calls in hooks, components receive props.
- Use Supabase Realtime for live UI updates (CoachPost, Alert, price channels).
- Shared types in `packages/shared/types.ts` — single source of truth for all request/response shapes.
- The flag column on left panel ticker cards must NOT render at all (not just hidden) when there is no alert — the card layout changes between having and not having the flag column.

## Gotchas

- X API cannot access Super Follows content — manual ingestion is the primary path, not a fallback.
- Coach's posts are heavily chart-based with bearish/short setups. The parser and proximity calculations must handle short direction correctly.
- DM Sans and DM Mono are a matched pair from Google Fonts. Import both.
- Supabase Storage for uploaded chart images. Store both the image and the analysis JSON on the CoachPost record.
- Market hours matter: full-speed polling 9:30AM-4:00PM ET, reduced pre/after-market, pause overnight.
- User is in Dallas, TX (Central Time) — account for CT→ET offset in market hour calculations.
