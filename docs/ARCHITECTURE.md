# Architecture

How GymOS fits together, for whoever maintains it next. Why things are this way is in [DECISIONS.md](DECISIONS.md); the visual system is in [DESIGN.md](DESIGN.md); legal and tax points are in [COMPLIANCE-NOTES.md](COMPLIANCE-NOTES.md).

## The shape of it

One Next.js 15 app (App Router) with three audiences:

| Area | URL | Who | Rendering |
| --- | --- | --- | --- |
| Public site | `/`, `/shop`, `/terms`, `/privacy`, `/signup` | Anyone | Server components (the shop reads the database directly) |
| Member app | `/member/*` | Signed-in members | Client components calling `/api/me/*` |
| Staff console | `/admin/*` | Signed-in staff, by role | Client components calling the staff API |

Everything that reads or changes data goes through a JSON API under `/api`. The API is the only security boundary: `middleware.ts` only redirects signed-out visitors to the right sign-in page.

```
browser ── pages (/, /member, /admin) ──┐
                                        ├── /api/* route handlers ── lib/* services ── Prisma ── PostgreSQL
Stripe ──── /api/webhooks/stripe ───────┘                                └── Stripe API, Resend API
Vercel cron ── /api/cron/churn-shield (daily jobs)
Door scanners ── /api/iot/checkin
```

## Request handling

Every route handler is wrapped by one of three functions in `lib/http/route.ts`:

- `publicRoute`: no session needed (sign-in, sign-up, public plans and catalogue).
- `memberRoute`: a member session. The member ID always comes from the session, never from the request, so one member can't act on another.
- `staffRoute({ permission })`: a staff session whose role grants that permission, any one of a list, or (`null`) any active staff member. Roles and their permissions are rows in the `Role` table, loaded on every request; the permission catalogue and the starting roles are in `lib/auth/permissions.ts`, and [PERMISSIONS.md](PERMISSIONS.md) has the full matrix. Record-level rules (trainers' own classes, members' private details, prices) are checked in `lib/auth/access.ts`, `lib/members/privacy.ts` and the plan and shop services.

Each wrapper, in order: blocks cross-site mutating requests (same-origin and JSON-only checks), applies an optional rate limit, checks the session against the database (so revoked sessions stop working immediately), then parses the body and query with Zod. Errors come back as `{ error: { code, message, fields } }`. Tests in `tests/integration/rbac.test.ts` call every route as every starting role and a custom role, as a member and signed out; `tests/integration/permissions.test.ts` covers the safeguards (always an owner, no granting what you don't have), invitations, prices and trainer scope.

Sessions are HMAC-signed cookies (`lib/auth/token.ts`) holding the account ID and a session version. Changing a password, archiving a member or erasing an account bumps the version and ends every session.

## Data

PostgreSQL through Prisma (`prisma/schema.prisma`). Money is always integer cents in AUD, and prices are GST-inclusive. GST is worked out with `lib/money.ts`: 1/11 of the inclusive amount, rounded to the cent.

Main models:

- **Members and plans:** `Member`, `MembershipPlan`, `MembershipEvent` (history of joins, pauses, plan changes and cancellations), `BenefitLedger` (class credits, guest passes and adjustments per billing cycle), `LegalAcceptance`, `MemberNote`.
- **Money:** `Payment` (table `Payout` for historical reasons; sequential `invoiceNumber`), `Refund`, `PaymentReminder`, `StripeEvent` (processed webhook IDs).
- **Classes:** `ClassTemplate` (weekly timetable), `Class`, `ClassBooking`, `ClassWaitlist`, `CheckIn`.
- **Shop:** `Product`, `ProductVariant` (stock), `Order`, `OrderItem` (prices frozen at purchase), `OrderEvent` (status history).
- **Operations:** `Staff`, `Role` (named sets of permissions, D-098), `AuthToken` (hashed single-use links for password resets and email confirmation, D-112, D-113), `AuditLog` (with old and new values, D-106), `Announcement`, `RateLimit`, plus the older `Equipment`, `InventoryItem`, `Shift` and `AgentAction`.

Migrations are in `prisma/migrations`. Each has a hand-written `down.sql` for rollback. `npm run build` never migrates; the Vercel build command migrates only for production deployments (see D-060).

## Business rules live in services

Route handlers stay thin and call `lib/<domain>/`: reads in `queries.ts`, writes and rules in `service.ts`, input schemas in `schema.ts`. Each write and its audit entry share one transaction. Lint stops pages, components and route handlers touching Prisma (D-089, D-090):

| Area | Module | Notes |
| --- | --- | --- |
| Membership changes | `lib/membership/service.ts` | Pause, resume, cancel (cooling-off, notice, minimum term), plan changes with proration, and the daily transitions. Used by both staff and member routes. |
| Benefits | `lib/membership/benefits.ts`, `cycle.ts` | Ledger balances per billing cycle, counted from when the membership started, in the gym's time zone. |
| Classes | `lib/classes/service.ts`, `timetable.ts` | Every booking path locks the class row (`SELECT ... FOR UPDATE`), so classes can't be overbooked. Waitlist promotion uses savepoints. |
| Check-in | `lib/checkin/service.ts`, `qr.ts` | Signed QR passes (`GYM1.`) with a version that reissuing bumps. Grace period for overdue payments. |
| Billing | `lib/billing/*` | Stripe client (lazy, test keys only), webhook processing, refunds (GST pro rata, idempotency key, guarded update), reminders, tax invoices. |
| Shop | `lib/shop/*` | `pricing.ts`, `limits.ts` and `labels.ts` (shared by server and browser), `queries.ts`, `service.ts`, `checkout.ts` (Stripe Checkout, webhook payment, expiry), `orders.ts` (status changes, stock), `emails.ts`. |
| Finance | `lib/finance/*` | Summaries by month, BAS quarter and financial year, AUD only. CSV exports neutralise spreadsheet formulas (`lib/csv.ts`). |
| Members | `lib/members/*` | Sign-up, password change, data export, erasure and anonymisation. |
| Legal | `lib/legal.ts` | Current document versions and acceptance records. |
| Plans, staff, roles, settings, announcements, audit log | `lib/plans/*`, `lib/staff/*`, `lib/roles/*`, `lib/settings/*`, `lib/announcements/*`, `lib/audit-log/*` | Queries, services and schemas per area; `lib/plans/perks.ts` is the one wording for plan benefits. |
| Daily jobs | `lib/jobs/daily.ts` | Transitions, reminders, timetable generation, retention scores, data retention, rate-limit clean-up. |

## Stripe

Test mode only; live keys are refused unless `STRIPE_ALLOW_LIVE_KEYS=true`. Without keys, payment actions answer "Payments aren't set up yet" and everything else works.

- **Memberships:** `POST /api/checkout` opens Stripe Checkout in subscription mode, with the price built from the plan (no Stripe price IDs to keep in sync). Plan changes, pauses and cancellations update the subscription.
- **Shop:** `POST /api/shop/checkout` prices the cart on the server, creates a pending order, and opens Checkout in payment mode with a 30-minute expiry.
- **Webhooks:** `/api/webhooks/stripe` verifies the signature, then `processStripeEvent` records the event ID and its effects in one transaction (retries are no-ops). Emails are sent after the commit.
- **Card details** never reach GymOS. Members update cards in the Stripe customer portal.

## Email

`lib/email/index.ts` posts to Resend's HTTP API. With no `RESEND_API_KEY`, sends are skipped and logged. Tests capture messages instead. Transactional emails (orders, payment reminders) always go; announcement and waitlist emails respect the member's preferences.

## Configuration

Two layers, both validated at startup:

- **`config/gym.config.json`** (`lib/config/schema.ts`): brand, legal name, ABN (checksum verified), address, timezone, hours, starting plans, and the owner's policies (cancellation, pauses, plan changes, failed payments, classes, shop, data retention, legal versions). The legal pages are generated from it. `npm run check:config` explains any problem.
- **Environment variables** (`lib/env.ts`, documented in `.env.example`): database, session secret, Stripe test keys, Resend, cron and door-scanner secrets.

## Front end

- Design tokens only (`tailwind.config.ts`, `app/globals.css`); light and dark themes. Fonts: Barlow Condensed and Atkinson Hyperlegible Next.
- Shared components in `components/ui` (buttons, panels, forms with wired-up errors, dialogs with focus trapping, data lists that become stacked rows on phones).
- Every data view handles loading, empty and error states through `AsyncBlock`.
- The member app (`components/member/member-shell.tsx`) loads `/api/me` once and shares it through context. It has a bottom tab bar on phones.
- PWA: `app/manifest.ts`, icons generated by `app/pwa-icon/[size]` and `app/apple-icon.tsx`, and `public/sw.js` (caches built assets, offline page, never caches API responses).

## Tests

- **Component** (`*.test.tsx` beside the page or component, jsdom): UI behaviour such as double submits, stale responses and dialogs.
- **Characterisation** (`tests/integration/characterisation.test.ts`): the shape of every GET response, pinned before the PR 5 rewrite.
- **Unit** (`lib/**/*.test.ts`): money and GST, dates, BAS and financial-year periods, membership rules, billing, webhook status mapping, CSV, QR tokens, sessions and passwords, permissions, the route wrapper, environment and config schemas, shop pricing, sign-in redirects.
- **Integration** (`tests/integration`): route handlers against a real PostgreSQL test database, with a fake Stripe client and signed webhook payloads. Covers permissions for every route, member data isolation, webhooks, refunds, finance, classes and credits, shop checkout and stock, sign-up, self-service and erasure.
- **End to end** (`tests/e2e`): Playwright against a production build on a seeded throwaway database, at 375px and 1440px, with axe accessibility checks on every main page. `E2E_SCREENSHOTS=1` writes the screenshots in `docs/screenshots`.
- **CI** (`.github/workflows/ci.yml`): config check, lint, type check, unit and integration tests, build, end-to-end tests.

## Where to start for common changes

- **New gym:** edit `config/gym.config.json`, run `npm run check:config`, see the README.
- **New staff permission:** follow "For developers" in [PERMISSIONS.md](PERMISSIONS.md): the catalogue in `lib/auth/permissions.ts`, a migration that gives it to the right starting roles, `staffRoute`, and the matrix in `tests/integration/rbac.test.ts`.
- **New member action:** add a service function in `lib/<domain>/service.ts`, a `memberRoute` under `app/api/me`, and add the route to the member-route refusal test.
- **New write that logs an audit entry:** do both inside one `db.$transaction` and add a case to `tests/integration/atomic-*.test.ts`.
- **Changing data from the browser:** use `useMutation` from `lib/client/api.ts`.
- **New Stripe event:** handle it in `lib/billing/webhook.ts` inside the transaction, and add a signed-payload test.
