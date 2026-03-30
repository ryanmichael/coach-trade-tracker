# Multi-User Options Finder — Requirements

**Version:** 1.0 | **Date:** 2026-03-29

> Enable 2-3 invited users to access the Options Finder feature with individual sandboxed data. Admin (Ryan) manages invites. Auth via email magic link through Supabase Auth.

---

## 1. Overview

The Options Finder is currently a single-user feature behind no real auth. This spec adds:

- **Email magic link authentication** via Supabase Auth
- **Invite-only access** — admin creates invites, uninvited emails are rejected
- **Per-user sandboxes** — each user has their own custom tickers, searches, and accuracy history
- **Shared coach feed** — ParsedTrade recommendations are visible to all users as starting suggestions
- **Simple admin page** — invite management for the admin

The main Coachtrack dashboard (feed, watchlist, active trades, alerts) is **not exposed** to invited users. They only see Options Finder.

---

## 2. Auth & Accounts

| ID | Requirement |
|----|-------------|
| A1 | **Email magic link auth** via Supabase Auth. No passwords. User enters email, receives a login link, clicks it, lands authenticated. |
| A2 | **Invite-only signup.** Only emails present in the `Invite` table can authenticate. Uninvited emails are rejected with a clear message. |
| A3 | **Admin seed.** Admin account (Ryan's email) is created via database seed script with `isAdmin: true`. This is the first and auto-accepted invite. |
| A4 | **Session management.** Supabase Auth handles sessions/refresh tokens. Magic link expires after 1 hour. Sessions last 7 days before requiring re-auth. |
| A5 | **Admin detection.** On login, the system matches the authenticated email to the `User` record. If `isAdmin: true`, admin UI (invite management) is visible. No special login flow — same magic link for everyone. |
| A6 | **User creation on first login.** When an invited email authenticates for the first time, a `User` record is created automatically (email from Supabase Auth, `isAdmin: false`). The corresponding `Invite` record is marked as accepted. |

---

## 3. Data Model Changes

### 3.1 New Tables

```prisma
model User {
  id              String            @id @default(cuid())
  supabaseAuthId  String            @unique   // Links to Supabase Auth user UUID
  email           String            @unique
  name            String?
  isAdmin         Boolean           @default(false)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  customTickers   CustomTicker[]
  optionsSnapshots OptionsSnapshot[]
}

model Invite {
  id         String    @id @default(cuid())
  email      String    @unique
  invitedBy  String                            // User ID of admin who invited
  invitedAt  DateTime  @default(now())
  acceptedAt DateTime?                         // Set on first login
}

model CustomTicker {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  ticker         String
  direction      String?  // "long" | "short"
  currentPrice   Float?
  targetPrice    Float?
  projectedDate  DateTime?
  stopLoss       Float?
  riskTolerance  String   @default("medium") // "high" | "medium" | "low"
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, ticker])
}
```

### 3.2 Modified Tables

```prisma
model OptionsSnapshot {
  // ... existing fields unchanged ...
  userId    String?   // NEW — nullable for backward compat with existing rows
  user      User?     @relation(fields: [userId], references: [id])
}
```

### 3.3 Data Ownership Summary

| Data | Ownership | Notes |
|------|-----------|-------|
| CoachPost, ParsedTrade | Shared (read-only for non-admins) | Coach recs visible to all as ticker suggestions |
| CustomTicker | Per-user | Replaces localStorage persistence |
| OptionsSnapshot | Per-user | Searches and accuracy scoped by userId |
| Invite | Admin-managed | Only admin can create |

---

## 4. User Sandbox

| ID | Requirement |
|----|-------------|
| S1 | Each user sees **shared coach recs** (from ParsedTrade) as starting ticker suggestions in TickerSelector. Read-only. |
| S2 | Each user manages their own **custom tickers**, persisted to the `CustomTicker` table (replaces localStorage). |
| S3 | Each user runs their own **options chain searches** (independent Polygon.io API calls). |
| S4 | Each user's **OptionsSnapshot history** and **AccuracyDashboard** are scoped to their `userId`. |
| S5 | **Users cannot see** each other's custom tickers, searches, or accuracy stats. |
| S6 | **Future placeholder:** Shared Dashboard — users save best contracts to a shared view. Not built in v1, but `CustomTicker` and `OptionsSnapshot` schema should not block this. |

---

## 5. Routes & Navigation

### 5.1 Page Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/login` | Public | Email input + "Send magic link" button. Redirects to `/options-finder` on success. |
| `/options-finder` | Authenticated | Main Options Finder. Redirects to `/login` if unauthenticated. |
| `/admin` | Admin only | Invite management. Redirects to `/options-finder` if non-admin. |

### 5.2 API Routes (New or Modified)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/api/auth/check-invite` | None | Validates email is in Invite table before Supabase sends magic link. Prevents unauthorized emails from receiving links. |
| `POST` | `/api/auth/on-login` | Supabase session | Called after first magic link login. Creates User record if not exists, marks Invite as accepted. |
| `GET` | `/api/admin/invites` | Admin | List all invites with accepted status. |
| `POST` | `/api/admin/invites` | Admin | Create a new invite (email). |
| `DELETE` | `/api/admin/invites/[id]` | Admin | Revoke an invite (only if not yet accepted). |
| `GET` | `/api/custom-tickers` | Authenticated | List current user's custom tickers. |
| `POST` | `/api/custom-tickers` | Authenticated | Add a custom ticker for current user. |
| `PATCH` | `/api/custom-tickers/[id]` | Authenticated | Update custom ticker fields. |
| `DELETE` | `/api/custom-tickers/[id]` | Authenticated | Remove a custom ticker. |
| `GET` | `/api/options/chain` | Authenticated | **Modified** — attach `userId` to OptionsSnapshot records. |
| `GET` | `/api/options/accuracy` | Authenticated | **Modified** — filter by current user's `userId`. |

---

## 6. UI Specifications

### 6.1 Login Page (`/login`)

- Full-screen, centered card on `--bg-base` background
- Coachtrack logo + "Options Finder" subtitle
- Email input field + "Send magic link" button (`--accent-primary`)
- **States:**
  - Default: email input + button
  - Submitting: button shows spinner
  - Sent: "Check your email for a login link. It expires in 1 hour."
  - Uninvited: "You don't have access yet. Contact the admin."
  - Error: "Something went wrong. Try again."
- Follows Mercury dark design tokens

### 6.2 User Indicator (Options Finder header)

- Top-right of PageHeader: user's email (truncated if long) + chevron
- Dropdown menu:
  - Email (non-interactive, `--text-secondary`)
  - "Sign out" link
- If admin: also shows "Manage invites" link → `/admin`

### 6.3 Admin Page (`/admin`)

- Simple page with Mercury dark styling
- Header: "Manage Invites" + back arrow → `/options-finder`
- **Invite form:** Email input + "Send Invite" button. Inline validation (valid email format, not already invited).
- **Invite list:** Table with columns:
  - Email
  - Status: "Pending" (`--semantic-warning`) or "Accepted" (`--semantic-positive`) with accepted date
  - Invited date
  - Actions: "Revoke" button (only for pending invites, `--semantic-negative`)
- Empty state: "No invites yet."

### 6.4 Middleware / Route Protection

- `/options-finder` — requires valid Supabase session. No session → redirect to `/login`.
- `/admin` — requires valid session + `isAdmin: true`. Non-admin → redirect to `/options-finder`.
- `/login` — if already authenticated, redirect to `/options-finder`.
- API routes under `/api/custom-tickers`, `/api/options/*` — return 401 if no session.
- API routes under `/api/admin/*` — return 403 if not admin.

---

## 7. Migration from Single-User

| ID | Requirement |
|----|-------------|
| M1 | **Fresh start.** All users begin with no custom tickers or options history. Existing `OptionsSnapshot` rows (from single-user era) get `userId: null` and are excluded from per-user queries. |
| M2 | **Seed admin.** Migration or seed script creates: (1) Invite record for admin email with `acceptedAt: now()`, (2) User record with `isAdmin: true`. |
| M3 | **localStorage deprecation.** Custom tickers move from localStorage to `CustomTicker` table. The Zustand store reads from API instead of localStorage. Old localStorage data is ignored. |

---

## 8. Non-Requirements (Explicitly Out of Scope)

- Rate limiting per user (2-3 users sharing one Polygon key is fine)
- User profile editing (name, avatar)
- Email notifications or onboarding emails
- Shared dashboard / cross-user visibility
- Access to main Coachtrack features (feed, watchlist, active trades, alerts) for invited users
- Password auth, OAuth, or any auth method other than magic link
- User self-deletion or account management
- Mobile-specific auth flows (responsive login page is sufficient)

---

## 9. Implementation Notes

### Auth Flow Sequence

```
1. User navigates to /options-finder
2. Middleware: no Supabase session → redirect to /login
3. User enters email, clicks "Send magic link"
4. Frontend calls POST /api/auth/check-invite with email
   → If not invited: show "no access" message, stop
   → If invited: proceed
5. Frontend calls Supabase Auth signInWithOtp({ email })
6. Supabase sends magic link email
7. User clicks link → Supabase Auth callback → session created
8. Redirect to /options-finder
9. On first load with session, call POST /api/auth/on-login
   → Creates User record if not exists
   → Marks Invite.acceptedAt
10. Options Finder loads with user context
```

### Key Integration Points

- **Supabase Auth** handles magic link sending, session tokens, and refresh. No custom token logic.
- **Supabase client** (`lib/supabase/client.ts`) already exists — extend with auth helpers.
- **Server-side auth** — API routes extract user from Supabase session, look up User record for userId and isAdmin.
- **Zustand store** (`stores/options-finder.ts`) — remove localStorage persistence for custom tickers, add API fetch/save calls.

### Build Order

1. Prisma schema changes (User, Invite, CustomTicker, OptionsSnapshot.userId)
2. Database migration + admin seed
3. Supabase Auth configuration (enable magic link provider, set redirect URLs)
4. Auth API routes (`/api/auth/check-invite`, `/api/auth/on-login`)
5. Middleware (route protection)
6. Login page UI
7. Admin page UI
8. Custom tickers API + migrate store from localStorage to API
9. Modify `/api/options/chain` and `/api/options/accuracy` to scope by userId
10. User indicator in Options Finder header
11. Test end-to-end: invite → login → search → accuracy → sign out
