# GymOS audit (Phase 0)

Audited: 3 October 2026, at commit `3154a42` (main, after PR #15). Nothing was changed while this audit was written.

Risk ratings: **High** means real member data, money or access is exposed or can be lost today. **Medium** means a plausible failure or exposure that needs a precondition. **Low** means hygiene, consistency or polish.

## 1. Stack

| Area | What's there |
| --- | --- |
| Framework | Next.js `14.1.0` (pinned exactly), React 18.3, App Router only (`app/`) |
| Language | TypeScript 5.9, `strict: true`, `allowJs: true` |
| Rendering | Every page is a client component (`"use client"`) that fetches JSON from `app/api/*` route handlers. No server components doing data access, no server actions |
| ORM / DB | Prisma 5.22, PostgreSQL (`DATABASE_URL`, Vercel Postgres per the schema comment). 7 migrations in `prisma/migrations` |
| Auth | Custom: staff-only email + password (Node `scrypt`), stateless HMAC-signed cookie `gymos_session` (12 h), `middleware.ts` gate plus per-route `requireRole()` |
| Roles | `OWNER > MANAGER > FRONT_DESK` (`lib/roles.ts`). No trainer role. Members cannot sign in at all |
| Payments | `stripe@14` SDK, API version `2023-10-16`, Checkout (subscription mode), Billing Portal, one webhook route |
| UI | Tailwind CSS 3.4 with CSS-variable colour tokens (`app/globals.css`), `lucide-react` icons, hand-rolled components in `components/ui.tsx`. Fonts: Inter and Space Grotesk |
| Tests | Vitest 1.6 (node environment), 4 files / 22 tests, all in `lib/` (session, password, roles, `requireRole`). No component, route-handler or end-to-end tests. No Playwright |
| Lint | `npm run lint` calls `next lint`, but there is no ESLint config or dependency, so it stops at an interactive prompt. Lint has never run |
| CI | None. No `.github/workflows` |
| Hosting | Vercel (`vercel.json` cron for `/api/cron/churn-shield` daily at 01:00 UTC). `npm run build` runs `prisma migrate deploy` against `DATABASE_URL` before `next build` |
| Env vars used | `DATABASE_URL`, `SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `IOT_GATEWAY_SECRET`. No `.env.example`, no startup validation |

Checks run on a clean install (Node 22): `tsc --noEmit` passes, `vitest run` passes (22/22), `next lint` cannot run (no config), `npm audit` reports 11 vulnerabilities (2 critical, 7 high, 2 moderate). No secrets were found in the git history (scanned for `sk_live`, `sk_test_`, `whsec_`, and Postgres URLs with credentials).

## 2. What exists today

Staff-facing operations dashboard. Every page is behind staff sign-in except the ones noted.

| Area | Files | Notes |
| --- | --- | --- |
| Owner setup and staff login | `app/setup`, `app/login`, `app/api/auth/*` | First-run creates one OWNER, after which `/api/auth/bootstrap` refuses |
| Dashboard | `app/page.tsx`, `app/api/dashboard/stats` | "Monthly revenue" (computed from plan list price × active members, not real payments), active members, check-ins today, alert count, recent check-ins, flagged equipment |
| Members | `app/members`, `app/members/[id]`, `app/api/members*` | List, client-side search by name or email, add/edit/delete modal, read-only detail page, referrals, CSV export |
| Plans and pricing | `app/settings` (PricingCard), `app/api/settings/plan-prices`, `lib/pricing.ts` | Four hard-coded enum plans (`BASIC`, `PREMIUM`, `PLATINUM`, `ELITE`), owner can edit the monthly price only |
| Billing | `app/billing`, `app/api/checkout`, `app/api/billing-portal`, `app/api/webhooks/stripe`, `app/api/payouts` | Stripe Checkout for subscriptions in USD, webhook updates member status and records `Payout` rows. No UI calls `/api/checkout` or `/api/billing-portal` |
| Classes | `app/classes`, `app/api/classes/*` | Create and cancel classes, book a member, waitlist, promote from waitlist, attendance (attended / no-show) |
| Shifts | `app/shifts`, `app/api/shifts/*` | Staff shift roster |
| Check-in | `app/reception` (public kiosk), `app/iot` (scan feed), `app/api/check-in`, `app/api/iot/checkin` | Type a member ID or email at the kiosk; IoT gateway endpoint with a bearer secret |
| Retention | `app/radar`, `app/api/cron/churn-shield` | Nightly retention score from visit recency, frequency and no-shows |
| Equipment | `app/equipment`, `app/api/equipment*`, `app/api/agent-actions` | Equipment health list, draft purchase orders stored as `AgentAction` rows for approval |
| Inventory | `app/inventory`, `app/api/inventory*` | Stock and consumables with atomic stock adjustments and reorder levels |
| Settings | `app/settings` | Gym profile (name, address, US timezones only), plan prices, feature toggles (keycard required, hide revenue from front desk), staff accounts, audit log (last 100) |
| Audit log | `lib/audit.ts`, `app/api/audit-log` | Most mutations log `staffName`, action, target and details |
| Marketing page | `app/marketing` | Public placeholder landing page |

## 3. Half-built or dead code

| Item | Evidence | Rating |
| --- | --- | --- |
| `/api/checkout` has no caller | No page posts to it. It also re-creates its own Stripe client instead of using `lib/stripe.ts`, and casts the API version `as any` | Medium |
| `/api/billing-portal` has no caller, and returns to `/dashboard`, which doesn't exist | `app/api/billing-portal/route.ts:16` | Medium |
| Checkout `success_url` sends the payer to the staff dashboard `/` | `app/api/checkout/route.ts:39`. A paying member would land on a staff login | Medium |
| `Payout` model is misnamed | Rows are incoming member payments (from `invoice.payment_succeeded`), not payouts | Low |
| `AgentAction` is a generic "approval" table used for equipment POs and as a billing event log | `app/api/webhooks/stripe/route.ts:47` writes "Subscription Completed" rows into it | Low |
| `Member.keycardIssued` exists but nothing can set it | No UI or API writes it after seeding | Low |
| `Member.notes` is in the schema, but no UI reads or writes it | | Low |
| `Equipment.healthScore` / `failureProbability` / `predictedFailureDate` | Seeded static numbers. Nothing computes them | Low |
| IoT comment "Update retention score logic ... could go here" | `app/api/iot/checkin/route.ts:54` | Low |
| `README.md` is two lines and mentions a "Poke assistant" | | Low |
| Schema comment "Deployment Trigger: Linking Vercel Postgres..." | `prisma/schema.prisma:1` | Low |
| `clsx` and `tailwind-merge` only used in `app/reception/page.tsx` via a local `cn()` | Fine to keep as the shared `cn()` helper, but it is duplicated locally | Low |
| `ts-node` used only for the seed script, with a CommonJS override in `tsconfig.json` | Replaceable with `tsx` | Low |

## 4. Security risks

### 4.1 High

| # | Finding | Where | Why it matters |
| --- | --- | --- | --- |
| S1 | **Next.js 14.1.0 is vulnerable to the middleware authorisation bypass** (GHSA for CVE-2025-29927, fixed in 14.2.25) plus 30-odd other advisories (2 critical, many high) | `package.json` | Most `GET` routes (`/api/members`, `/api/members/[id]`, `/api/payouts`, `/api/dashboard/stats`, `/api/classes`, `/api/shifts`, settings) have **no role check of their own** and rely entirely on `middleware.ts`. A request carrying the bypass header could read every member's PII and payment history. Whether Vercel's edge already strips the header can't be verified from here; the code must not depend on it |
| S2 | **Public check-in API leaks member PII and allows enumeration** | `middleware.ts` excludes `api/check-in`. `POST /api/check-in` takes any email or ID and returns name, email, plan, status and retention score. `GET /api/check-in` returns the last 10 check-ins with names and emails, unauthenticated | Anyone on the internet can confirm whether an email is a member, read their plan, status and retention score, write fake check-ins (polluting attendance and retention), and watch who is in the gym in real time. Both the kiosk page `/reception` and its API are deliberately public |
| S3 | **Cron and IoT secrets fail open when unset** | `app/api/cron/churn-shield/route.ts:5`, `app/api/iot/checkin/route.ts:6` compare against `` `Bearer ${process.env.X}` `` | If `CRON_SECRET` or `IOT_GATEWAY_SECRET` is missing, the expected value becomes the literal `Bearer undefined`, which an attacker can send. The IoT route then grants door access for any member ID. The comparison is also not constant-time |
| S4 | **Missing authorisation on GET routes (defence in depth)** | `/api/members`, `/api/members/[id]`, `/api/payouts`, `/api/dashboard/stats`, `/api/agent-actions`, `/api/equipment`, `/api/inventory`, `/api/classes`, `/api/shifts`, `/api/settings/*` | Any signed-in staff member, including front desk, can read full payment history and revenue. The "hide revenue from front desk" toggle is enforced **only in the browser** (`app/page.tsx:34`, `app/billing/page.tsx:45`); the API still returns `revenueCents` and every payment |
| S5 | **`/api/checkout` and `/api/billing-portal` have no role check and trust the body** | `app/api/checkout/route.ts`, `app/api/billing-portal/route.ts` | Any session can open a Stripe billing-portal session for **any** member's Stripe customer by ID, which shows their card's last four digits, invoices and address. Checkout also reflects raw Stripe error messages to the client |
| S6 | **Stripe webhook is not idempotent** | `app/api/webhooks/stripe/route.ts` | Stripe retries deliveries. Each `invoice.payment_succeeded` retry inserts another `Payout`, double-counting revenue. There's no stored event ID. `invoice.payment_succeeded` also never moves a `PAST_DUE` member back to `ACTIVE` |
| S7 | **Seed script wipes real tables** | `prisma/seed-data.ts` calls `deleteMany({})` on `CheckIn`, `Payout`, `Equipment`, `ClassBooking`, `Class` | Running `npx prisma db seed` with a production `DATABASE_URL` deletes all check-ins, payments, classes and bookings. There's no environment guard |
| S8 | **Member hard delete destroys financial records** | `DELETE /api/members` deletes the member's `Payout` rows in a transaction | Payment history needed for tax records (the ATO expects records to be kept for 5 years) and refunds disappears. Should be soft delete or anonymisation, keeping the financial rows |

### 4.2 Medium

| # | Finding | Where |
| --- | --- | --- |
| S9 | **No rate limiting anywhere.** Login, the public check-in API and the IoT endpoint can be brute-forced or flooded | `app/api/auth/login`, `app/api/check-in`, `app/api/iot/checkin` |
| S10 | **Sessions can't be revoked.** Deleting a staff account or demoting a role has no effect until the 12 h token expires. Logout only clears the cookie | `lib/session.ts`, `app/api/auth/logout` |
| S11 | **No input validation library.** Bodies are destructured and passed to Prisma directly. `PUT /api/members` passes `status` and `plan` unchecked (bad values → 500), emails aren't normalised, `POST /api/equipment` writes `body.*` straight into the DB | `app/api/members/route.ts:76`, `app/api/equipment/route.ts:17` |
| S12 | **Error messages leak internals.** `error.message` from Stripe is returned to the browser | `app/api/checkout/route.ts:52`, `app/api/billing-portal/route.ts:25` |
| S13 | **Prisma logs every query in production** (`log: ["query"]`), which writes member emails and IDs into Vercel logs | `lib/prisma.ts:7` |
| S14 | **Class capacity race.** The "check count then insert" transaction runs at READ COMMITTED, so two concurrent bookings for the last spot can both succeed (the `@@unique` only stops the same member twice) | `app/api/classes/[id]/book/route.ts`, `.../waitlist/promote/route.ts` |
| S15 | **CSRF relies only on `SameSite=Lax`.** There's no origin check. The JSON routes parse `text/plain` bodies too, so this depends entirely on browser cookie behaviour | All mutating routes |
| S16 | **No security headers** (CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`). The admin can be framed | `next.config.mjs` |
| S17 | **Login redirect isn't validated.** `?from=` is pushed with `router.push`. `router.push` won't follow off-site URLs, so impact is low, but it should be restricted to relative paths | `app/login/page.tsx:46` |
| S18 | **`npm run build` runs `prisma migrate deploy`** against whatever `DATABASE_URL` is set, including a developer's local build pointed at production | `package.json`, `scripts/deploy-migrations.js` |
| S19 | **Session secret strength isn't checked.** Any non-empty string is accepted as the HMAC key | `lib/session.ts:30` |
| S20 | **Webhook handler isn't wrapped in try/catch.** A DB error returns a 500 with no logging context, and `checkout.session.completed` throws on an unknown `memberId` | `app/api/webhooks/stripe/route.ts` |

### 4.3 Low

- `verifyPassword` timing differs for unknown emails (no dummy hash), which makes user enumeration by timing possible. The error message itself is generic.
- Password policy is "8+ characters" only, with no breached-password check.
- `/api/auth/bootstrap` has a race: two simultaneous first-run requests could both create an OWNER. The window is tiny and only exists on a fresh install.
- `stripeCustomerId` and `stripeSubscriptionId` are unique, but the webhook uses `updateMany` by subscription ID, which hides a missing row.

## 5. Data model problems

| # | Problem | Rating |
| --- | --- | --- |
| D1 | **Plans are a Postgres enum.** A gym can't add, rename or retire a plan, set an annual price, or attach perks without a migration. Prices live in a separate `PlanPrice` table keyed by the enum | High (blocks most of the target features) |
| D2 | **Members have no login, no password or magic link, and no link to Stripe beyond IDs.** The whole member side needs an identity | High |
| D3 | **Money in USD everywhere** (`currency: "usd"`, `formatCents` uses `en-US`/USD). No GST, ABN, tax invoice numbers or invoice records | High (Australian context) |
| D4 | **No subscription or billing state model.** Next billing date, pause windows, cancellation effective date, proration and failed-payment attempts aren't stored. `Member.status` is the only billing state | High |
| D5 | **`Payout` is really "payment received"**: no Stripe invoice or payment intent ID (so it can't be de-duplicated or refunded), no GST component, no plan snapshot | High |
| D6 | **`Class` has `instructor: String?`**, not a link to a staff trainer. There's no recurring timetable template (every class is a one-off row) and no class-credit consumption | Medium |
| D7 | **No products, variants, orders or carts.** `InventoryItem` is back-of-house stock with a cost price only, no retail price | Medium |
| D8 | **`CheckIn` has no foreign-key `onDelete`** (defaults to restrict), which is why delete has to hand-clear rows. No method (QR, keycard, manual) or staff who checked them in | Medium |
| D9 | **`GymProfile.timezone` defaults to `America/New_York`**, and the settings UI offers US zones only | Medium |
| D10 | **No indexes** on `CheckIn(memberId, timestamp)`, `CheckIn(timestamp)`, `ClassBooking(memberId)`, `Payout(createdAt)` or `AuditLog(createdAt)`. Dashboard and churn queries will scan | Medium |
| D11 | **`retentionScore` defaults to 100 for a brand-new member** and is overwritten nightly. That's fine, but it's stored on the member row instead of being derived | Low |
| D12 | **`Status` spelling is `CANCELED`** (US) and plan/status enum values are shown raw in the UI (`PAST_DUE`) | Low |
| D13 | **Singleton tables** (`GymProfile`, `GymSettings`) duplicate what should be validated config, and there are two of them | Low |
| D14 | **`AuditLog.staffName` is denormalised** (good for a deleted staff member) but there's no IP or user agent, and member actions can't be logged because there's no member identity | Low |

## 6. Dependency problems

| Package | Current | Issue | Rating |
| --- | --- | --- | --- |
| `next` | 14.1.0 | 2 critical, 12 high advisories (middleware auth bypass, SSRF in server actions, cache poisoning, DoS). Latest 14.x patch (14.2.35) clears the 14-line advisories; several are only fixed in 15.5.x | High |
| `vitest` | 1.6.0 | Critical advisories (RCE when the API/UI server listens). Dev-only, but should be upgraded | Medium |
| `postcss` (via next) | bundled | High advisories (source-map path traversal). Build-time only | Medium |
| `braces`, `esbuild`, `vite` | transitive | High/moderate, dev or build-time | Low |
| `stripe` | 14.25 | Major versions behind (latest 23). API version `2023-10-16` is old. Works, but the upgrade needs care | Low (for now) |
| `@prisma/client` / `prisma` | 5.22 | Major versions behind (latest 7). Upgrade isn't required for this work | Low |
| `lucide-react` | 0.344 | Old, but fine | Low |
| `ts-node` | 10.9 | Only for seeding. Replace with `tsx` | Low |
| Missing | | No `zod`, no ESLint, no Playwright, no axe, no QR library, no email library | Medium |

No unused production dependencies were found (`clsx` and `tailwind-merge` are used once, in the reception page).

## 7. Structure and naming inconsistencies

- Route names don't match their content: `/radar` is "Retention", `/iot` is "Access control", `/billing` shows "payouts", `/api/payouts` returns incoming payments, and `agent-actions` is the purchase-order approval queue.
- Mixed quote styles (`'` in Stripe/equipment routes, `"` elsewhere) and mixed casing for audit actions.
- Each route defines its own `XxxError` class (`BookingError`, `PromoteError`, `WaitlistError`) with identical shapes.
- Role checks are in every handler, but there is no shared "parse body, check role, run, log, map errors" helper, so validation and error handling vary per file.
- `lib/stripe.ts` exists, but `app/api/checkout/route.ts` builds its own client.
- Plan labels are defined in three places (`app/settings/page.tsx`, the members form, `lib/pricing.ts`).
- Business data is spread across the DB singleton (`GymProfile`), hard-coded strings ("GymOS", "Main Entrance") and code constants (`PLAN_PRICES`). There's no single config for branding or business details.
- US spelling and locale throughout: "canceled", "Canceled", `en-US`, `usd`, `America/*`.
- Copy has 22 em dashes and arrows appended to links ("Create the owner account →").

## 8. Loading, empty and error states

- **Loading:** every page shows a plain "Loading…" text, and dashboard stat tiles show "—". There are no skeletons, and no `loading.tsx` or `error.tsx` route files.
- **Empty:** most lists have an `EmptyState`. Missing on the member detail payments for front desk, the audit log when empty, and the shifts page when there are no staff.
- **Error:** failures are mostly swallowed into `console.error`. The members add/edit form silently does nothing on a 400 or 500 (`app/members/page.tsx:60`), and the dashboard shows "—" forever if stats fail. Others use `alert()` (11 calls of `alert`/`confirm`). There is no `not-found.tsx`, and a bad member ID shows "Member not found" only after the fetch.

## 9. Accessibility and mobile problems

- **Labels:** 35 `<label>` elements have no `htmlFor` and the inputs have no `id`, so screen readers don't announce field names. Placeholders stand in for labels on the search fields.
- **Modals:** these are `div`s with no `role="dialog"`, no `aria-modal`, no focus trap, no Escape-to-close, and no focus return (members, classes, shifts, inventory, staff).
- **Tables on mobile:** `members`, `inventory` and `billing` render full tables with no horizontal scroll container or card layout. At 375px the members table's actions column falls off screen.
- **Mobile menu:** the drawer opens and closes and the backdrop closes it, but focus isn't moved into the drawer, there's no Escape handling, the backdrop `div` is a click target with no keyboard equivalent, and the page behind can still scroll. The behaviour itself is sound; these are additive fixes (kept per the brief).
- **Theme:** dark mode is applied after hydration from `localStorage`, so there's a flash of light theme on load. `prefers-color-scheme` is ignored.
- **Colour contrast (computed):** `text-ink-soft` (#6F6A61) on `chalk` (#F5F3EE) is 4.84:1 (passes AA). White on `ember` (#C1531F) is 4.64:1 (passes, narrowly). `ink-soft` on `surface-muted` (#EDEAE2) is 4.47:1, which **fails** AA for the small text used in badges and table headers.
- **Icon-only buttons** mostly have `aria-label` (good). The `Toggle` component is a proper `role="switch"`.
- `<html lang="en">` should be `en-AU`.
- The kiosk `autoFocus` input is fine for its use. The login page `autoFocus` is acceptable.

## 10. Design notes (against the brief's design direction)

- **Fonts:** Inter (body) and Space Grotesk (display) are both on the "avoid" list and must be replaced.
- **Colour:** the warm "chalk / ember" palette is already specific and not purple, which is a good base to keep. But ember (#C1531F) on cream reads close to the warm-terracotta-on-cream look that is itself a known generated-design default, so the tokens need a deliberate redesign rather than a light touch.
- **Logo:** a `Zap` lightning icon in a rounded square, the generic "icon in a rounded square" logo.
- **Status pills** use `rounded-full` (acceptable for status, but they're the only shape language). There are no gradients, no glassmorphism and no gradient text.
- **Copy:** em dashes throughout, "→" arrows on links, and US spelling.

## 11. Test and CI gaps

- No tests for any route handler, webhook, money calculation, booking capacity, inventory adjustment or check-in.
- No test proves a front-desk user can't read revenue, or that the public check-in route can't leak data (it can).
- No end-to-end tests, no accessibility tests, no Lighthouse budget.
- `vitest` runs in a `node` environment with no DOM, so components can't be tested.
- No CI: nothing stops a type error, failing test or broken build from merging.
- No seed data for the dev or e2e database separate from the destructive seed.

## 12. What gets fixed where

Phase 1 (PR 1) takes every High and Medium item in sections 4–6, the structure items in 7, the states in 8, and the accessibility items in 9. D1–D5 (data model) are fixed in Phase 1 only as far as a safe foundation goes (plans as data, money in AUD with GST, member identity, payment records with Stripe IDs). The feature work built on them comes in Phases 2 and 3. Decisions are recorded in `docs/DECISIONS.md`.
