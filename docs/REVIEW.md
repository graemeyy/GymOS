# Code review

A full review of the GymOS codebase as of PR 3 (`claude/clever-mayer-i0kufm-member`, commit `80eb0fa`), done before any clean-up. Every file was read. Five areas were reviewed in parallel (money and Stripe; membership, dates and classes; authentication and every API route; React and Next.js; data, tooling and code quality), then each finding was checked against the code. One reported finding was dropped as wrong: rate-limit rows *are* cleaned up by the daily job.

**How to read this.** Severity:

- **Critical:** money lost or wrongly recorded, a security breach, or data corruption.
- **High:** a real bug users will hit, or a real security weakness.
- **Medium:** an edge-case bug, or a maintainability problem that will cause bugs.
- **Low:** clean-up, style, small risk.

Each item says which pull request closes it: **PR 4** (bug fixes), **PR 5** (rewrite to [CODE-STANDARDS.md](CODE-STANDARDS.md)), **PR 6** (permissions), or **Open** with the reason. Line numbers are from commit `80eb0fa`.

Tooling at review time: lint, type-check, 682 unit and integration tests, the build and 67 end-to-end tests all pass. `prisma validate` passes, there is no schema drift, and `npm audit --omit=dev` reports nothing.

## Critical

| ID | Where | Problem | Closed by |
|---|---|---|---|
| R-01 | `lib/billing/webhook.ts:86-93` | **A new member's first payment can be lost.** `handleInvoicePaid` finds the member only by `stripeSubscriptionId`/`stripeCustomerId`, which are written by `checkout.session.completed`. Stripe doesn't guarantee event order, so when `invoice.paid` arrives first it returns early, the event is marked processed and never retried. No Payment row, no tax invoice, takings and GST understated. | PR 4 |

## High

| ID | Where | Problem | Closed by |
|---|---|---|---|
| R-02 | `lib/checkin/service.ts:13-24` | **Members who haven't paid get in.** `accessDecision` refuses archived, paused, cancelled and expired past-due members, but has no rule for `PENDING`, so anyone who signs up online can show their QR pass and be checked in. | PR 4 |
| R-03 | `lib/membership/service.ts:70-78`, `lib/billing/webhook.ts:15-17` | **A pause booked for later starts in Stripe immediately.** `pause_collection` is sent when the pause is booked, whatever the start date. Stripe voids every invoice from then on, and the resulting `subscription.updated` webhook marks the member PAUSED (no access) weeks early. | PR 4 |
| R-04 | `lib/membership/benefits.ts:38-51, 65-78` | **Class credits carry over without limit.** Balances count ledger rows by when they were written. A booking made at the end of one cycle and cancelled in the next adds credits to the new cycle, so a "2 classes a week" plan can be stretched indefinitely. | PR 4 |
| R-05 | `app/api/classes/[id]/route.ts:5-16`, `lib/classes/timetable.ts:18-29` | **Cancelling a class deletes it, loses members' credits, and the daily job recreates it.** The hard delete cascades bookings without returning credits. `generateClasses` dedupes on `(templateId, startTime)`, so the next daily run puts the cancelled class back on the timetable, open for booking. | PR 4 |
| R-06 | `app/api/members/[id]/route.ts:78-118` | **Staff can change status and plan without any of the side effects.** PUT writes `status` and `planId` straight to the row: no Stripe call, no history event, stale `pastDueSince`/`pausedUntil`/`pendingPlanId`. Setting CANCELED leaves Stripe charging; setting PAUSED never resumes; changing the plan leaves Stripe on the old price. | PR 4 |
| R-07 | `lib/membership/service.ts:118-137`, `app/api/me/membership/route.ts:42` | **Cooling-off and minimum term count from sign-up, not from when the membership started.** A member who signed up on 1 Oct, paid on 10 Oct and cancelled on 11 Oct gets 14 days' notice instead of their cooling-off right. Re-joining members get no cooling-off at all. | PR 4 |
| R-08 | `lib/billing/webhook.ts:64-81` | **Late or out-of-order subscription events overwrite newer state.** A delayed `subscription.updated` (active) after `subscription.deleted` gives a cancelled member free access; a stale `past_due` after `invoice.paid` leaves a paying member PAST_DUE with no `pastDueSince`, so they are locked out at once and never reminded. | PR 4 |
| R-09 | `lib/billing/webhook.ts:125-142` | **Refunds made in the Stripe dashboard aren't recorded.** Since Stripe API 2022-11-15 a charge in an event payload no longer includes its `refunds` list, so the loop over `charge.refunds.data` does nothing. The test hand-builds a payload with the list, so it passes. | PR 4 |
| R-10 | `lib/billing/refunds.ts:34-67` | **A card can be refunded twice.** If the `charge.refunded` webhook records the refund before the request's own transaction, the request fails with "That already exists" after the money has gone. Retrying uses a new idempotency key (it includes `refundedCents`, which the webhook just changed), so Stripe refunds again. The request's transaction would also double-count `refundedCents`. | PR 4 |
| R-11 | `app/api/products/[id]/route.ts:24-31`, `app/admin/(console)/shop/products/[id]/page.tsx:93` | **Saving a product overwrites live stock.** The editor posts the stock it loaded, and the update writes it as an absolute value. Units sold while the form was open come back as sellable, so the shop oversells. It also bypasses the stock-adjustment permission and audit entry. | PR 4 |
| R-12 | `lib/membership/service.ts:230-242` | **Every plan change for a card-paying member fails.** `subscriptions.update` is given `price_data.product_data`, which Stripe only accepts on Checkout line items; subscription items need a `product` ID. `as never` hid the type error and the fake Stripe client accepts anything. | PR 4 |
| R-13 | `app/member/membership/page.tsx:45`, `components/admin/member/membership-panel.tsx:161`, `app/api/me/membership/pause/route.ts:5` | **Pause dates are a day out.** The member pause dialog takes "today" in UTC (yesterday before 10 or 11am in Sydney), and plain `YYYY-MM-DD` dates are parsed as UTC midnight, so pauses start and end at 10 or 11am local, a day late after the 1am daily job. | PR 4 |
| R-14 | `components/admin/qr-scanner.tsx:43-49` | **The camera can stay on after the scanner closes.** If the dialog closes while `getUserMedia` is pending, the early return never stops the tracks. | PR 4 |
| R-15 | `app/admin/(console)/check-in/page.tsx:41-58` | **One failed scan breaks every scan after it.** The input is cleared only on success, so the next USB scan is appended to the failed code. | PR 4 |
| R-16 | `lib/announcements.ts:17-34`, `app/admin/(console)/announcements/page.tsx:219` | **Announcement emails can go out twice.** `emailedAt` is checked first but set only after the whole send loop; two clicks (the button has no busy state) or a timeout and retry email everyone again. | PR 4 |

## Medium

### Money and Stripe

| ID | Where | Problem | Closed by |
|---|---|---|---|
| R-17 | `lib/billing/refunds.ts:16-21`, `lib/billing/webhook.ts:136` | GST on partial refunds is rounded per refund, so the parts can add up to more than the GST collected ($20.00 payment, GST 182c; refunds of $5 then $15 give 46c + 137c = 183c). The formula is duplicated. | PR 4 |
| R-18 | `lib/billing/refunds.ts:56-66` | After concurrent partial refunds the payment status and the "fully refunded" decision use the stale pre-transaction total, so a fully refunded payment can stay "partially refunded" and its shop order is never marked refunded or restocked. | PR 4 |
| R-19 | `lib/billing/webhook.ts:200-203` | Every unique-constraint error inside a webhook transaction is reported as a duplicate event and answered 200, so a genuine clash (for example a customer ID already on another member) silently drops the event. | PR 4 |
| R-20 | `lib/billing/webhook.ts:113-121` | Paying an older invoice (for example a staff retry of last month's) moves the billing period backwards and clears debt from a newer failed invoice. | PR 4 |
| R-21 | `app/api/checkout/route.ts:17-44`, `lib/billing/webhook.ts:40-62` | Two checkout tabs can create two subscriptions; the second completion overwrites `stripeSubscriptionId`, so the first keeps charging and the app can't cancel it. | PR 4 |
| R-22 | `lib/finance/range.ts:19` | A custom finance range ends 24 hours after the start of the last day, which is an hour short or long on daylight-saving change days. | PR 4 |
| R-23 | `lib/billing/invoice.ts:44`, `lib/finance/reports.ts:26` | Tax invoices and finance periods use when the webhook was processed (`Payment.createdAt`), not when the money was paid. A payment at 11:50pm on 30 June processed after midnight lands in the next financial year. | PR 4 |
| R-24 | `app/api/checkout/route.ts`, `lib/shop/checkout.ts` | Checkout doesn't restrict payment methods. If the owner enables an asynchronous method (for example BECS direct debit), memberships go active before payment and shop orders paid that way are never marked paid. | PR 4 |
| R-25 | `lib/billing/webhook.ts:133` | Refunds that later fail are never reversed (no handler for refund status updates). | Open: needs a handler for refund status events, which can't be verified without real Stripe; listed in the final report |
| R-26 | `lib/billing/webhook.ts` | The handlers read fields removed in newer Stripe API versions (`invoice.subscription`, `invoice.payment_intent`). Webhook payloads follow the endpoint's API version, not the SDK's. | PR 4 (the version is checked and logged; README says which version to set) |

### Membership, classes and dates

| ID | Where | Problem | Closed by |
|---|---|---|---|
| R-27 | `lib/membership/service.ts:62-66, 150-152` | A member can pause while a cancellation is booked, and cancelling doesn't clear a pause, so the daily job later "resumes" a cancelled member. | PR 4 |
| R-28 | `lib/membership/service.ts:196-202` | Upgrade or downgrade is decided by price alone, ignoring the billing interval, and cross-interval changes are previewed as costing nothing. | PR 4 |
| R-29 | `lib/membership/cycle.ts:12-20, 46-49` | Monthly cycles drift and never return to the anchor day (31 Jan, 28 Feb, 28 Mar instead of 31 Mar) and use the UTC day. | PR 4 |
| R-30 | `lib/dates.ts:26-30` | `startOfTodayIn` is an hour out on daylight-saving change days (today, 4 Oct 2026, is one), so the dashboard's "today" figures are off. | PR 4 |
| R-31 | `lib/classes/service.ts:27-48`, `lib/membership/benefits.ts:65-74` | Two bookings of different classes at the same moment can both spend the last credit; only the class row is locked. | PR 4 |
| R-32 | `app/api/class-templates/[id]/route.ts:5-8` | Editing a template's time creates a second class for every day already generated. PUT doesn't check the trainer exists, and a bad ID gives a 500. | PR 4 |
| R-33 | `app/api/classes/route.ts:15-28`, `app/api/members/route.ts:17`, `lib/auth/permissions.ts:62` | Trainers can read every member's email, notes and billing state, and every class's booking list. | PR 6: trainers see only their own classes and booked members' names; private details need `members.view_sensitive` (D-105) |
| R-34 | `lib/checkin/qr.ts`, `app/api/check-in/route.ts` | QR passes never expire, so a shared screenshot works until staff reissue it. | Open: rotating passes would be a new feature; reissue exists |
| R-35 | `lib/jobs/daily.ts:53-60`, `lib/membership/service.ts:268-303` | One failing step skips the rest of the daily jobs; each member's transition and its history event aren't in one transaction; a query per member. | PR 4 |
| R-36 | `app/api/members/route.ts:47-53` | Members created by staff are ACTIVE (with any plan) with no billing set up. Front desk, which can't change billing, can create a free active member. | PR 4 |
| R-37 | `lib/membership/service.ts:79`, `app/terms/page.tsx` | The pause fee is recorded but never charged, while the terms say "A pause costs $X". Latent: the fee is $0. | Open: charging it is a feature; the setting is documented as "not charged yet" |
| R-38 | `app/api/plans/[id]/route.ts:13-16` | Changing a plan's interval applies to existing members immediately, while their Stripe subscriptions keep the old interval. | PR 4 |
| R-39 | `lib/members/service.ts:48-80`, `lib/members/account.ts:140-146` | Archiving or erasing a member removes their future bookings without promoting anyone from the waitlist. | PR 4 |

### Security and privacy

| ID | Where | Problem | Closed by |
|---|---|---|---|
| R-40 | `app/api/auth/login/route.ts:13`, `app/api/auth/member-login/route.ts:12` | Anyone who knows a staff email can keep that account locked out: the per-account limit counts every attempt from any address, before the password is checked. | PR 4 |
| R-41 | `lib/rate-limit.ts:35-48` | Staff and member sign-ins share one per-address limit, so members on the gym's Wi-Fi can block staff sign-in. The address is taken from `x-forwarded-for`, which is only trustworthy behind Vercel. | PR 4 (separate limits; trusted header order documented) |
| R-42 | `app/api/auth/bootstrap/route.ts:8-20` | Whoever reaches a fresh deployment first becomes the owner. | PR 4 (production requires `SETUP_TOKEN`) |
| R-43 | `app/api/members/[id]/route.ts:30`, `app/api/admin/plans/route.ts:9`, `app/api/orders/*` | "Hide revenue from front desk" leaks money: amount owing on the member record, plan prices with member counts (enough to rebuild revenue), order totals. | PR 4 (member and plans); order totals stay visible to people fulfilling orders, by design, and PR 6 makes it a permission |
| R-44 | `app/api/me/announcements/route.ts:7-12` | Members who haven't paid, or have cancelled, can read members-only announcements (which may include a door code). | PR 4 |
| R-45 | `app/api/staff/me/password/route.ts:12` | No rate limit on checking a staff member's current password. | PR 4 |
| R-46 | `lib/checkin/service.ts:52`, `lib/jobs/daily.ts:47` | Visit history is kept forever in the audit log (`member.checked_in`), past the retention period the privacy policy promises. | PR 4 |
| R-47 | `lib/members/account.ts:140-180` | Erasing a member scans the whole audit log (no index on target) and updates rows one by one inside a transaction. | PR 4 |

### React and Next.js

| ID | Where | Problem | Closed by |
|---|---|---|---|
| R-48 | `components/shop/add-to-cart.tsx:15-50` | After adding items, the quantity isn't clamped to what's left, so "Add to cart" is disabled with no explanation. | PR 4 |
| R-49 | `components/shop/cart-view.tsx:93` | When stock drops below what's in the cart, choosing the shown quantity doesn't fire a change, so checkout stays blocked. | PR 4 |
| R-50 | `app/member/orders/[id]/page.tsx:52-57` | `?paid=1` stays in the URL; pressing Back later empties a new cart. | PR 4 |
| R-51 | `app/admin/(console)/settings/page.tsx:173-174` | Toggling two settings quickly can undo the first (each save sends the whole stale object). | PR 4 |
| R-52 | `lib/client/api.ts:59-80` | `useResource` doesn't discard stale responses on reload, and shows the previous page's data while a new URL loads (member timetable "Next week" briefly shows this week). | PR 4 |
| R-53 | `app/admin/(console)/check-in/page.tsx:58` | `onScan` changes identity every render, so the camera restarts. | PR 4 |
| R-54 | `components/tax-invoice.tsx:4` | The invoice date is formatted in the viewer's time zone, not the gym's. | PR 4 |
| R-55 | `app/admin/(console)/members/[id]/page.tsx:111` | After a membership change the history and benefits panels don't refresh. | PR 4 |
| R-56 | `components/admin/member-form-dialog.tsx:48-58` | The edit form resets while typing when the plans list arrives, and a member on a retired plan shows "No plan". | PR 4 |
| R-57 | Many console pages (see below) | Mutations without a busy state can be sent twice: cancel class, attendance, delete shift (also no confirmation), reissue pass, approve/reject equipment, timetable and inventory deletes. | PR 4 (dangerous ones), PR 5 (shared mutation hook everywhere) |
| R-58 | `public/sw.js:5` | The service worker cache never evicts old builds, so storage grows on members' phones. | PR 4 |
| R-59 | `components/admin/admin-shell.tsx:150-171` | The mobile drawer keeps the page scroll-locked if the window grows past the breakpoint, and stays open after browser Back. | PR 4 |
| R-60 | `app/admin/setup/page.tsx:39` | Any error loading setup status is shown as "Already set up". | PR 4 |
| R-61 | `app/member/classes/page.tsx:53-66` | One busy flag for all booking buttons lets a second booking re-enable the first while it's pending. | PR 4 |
| R-62 | `lib/client/format.ts:1` and 8 other client modules | Client code imports the full gym config, which bundles Zod and parses the schema in the browser. | PR 5 |

### Data and tooling

| ID | Where | Problem | Closed by |
|---|---|---|---|
| R-63 | `app/api/members/[id]/route.ts:78-85`, settings page | "Require a keycard" can lock everyone out: no screen or API can mark a keycard as issued. | PR 4 |
| R-64 | `prisma/migrations/20261004000000_phase2_owner_features/down.sql:15,28` | The rollback drops refunds and invoice numbers, which are tax records. | PR 4 (rollback keeps them in archive tables) |
| R-65 | `tests/e2e/owner.spec.ts:266-301` | End-to-end tests share seed rows between runs and depend on earlier tests, so a retry can fail. | PR 4 |
| R-66 | `prisma/schema.prisma` | Foreign keys used in joins and filters have no index: `OrderItem.orderId`, `Refund.paymentId`, `AuditLog.targetType/targetId` and `staffId`, `Member.referredById`, `ClassWaitlist.memberId`, `Order.paidAt`. | PR 4 (the ones used by bug fixes and hot paths) |
| R-67 | `prisma/migrations/20261004000000_phase2_owner_features/migration.sql:54` | Adding `invoiceNumber` as `SERIAL NOT NULL` rewrote the table under a lock and numbered existing payments in physical order, not by date. | Open: already shipped; recorded in DECISIONS (D-079) with the rule for future columns |
| R-68 | `scripts/deploy-migrations.js:28-33` | The baseline fallback marks only the first prototype migration as applied; a database made with `db push` from a later prototype would fail on the second. | Open: can't be verified without the real database; the owner should check `_prisma_migrations` before the first deploy (final report) |
| R-69 | `.github/workflows/ci.yml` | CI doesn't check for schema drift, run `prisma validate`, or test the down migrations. | PR 4 (drift and validate), PR 5 (down-migration round trip) |
| R-108 | `lib/audit-query.ts:11-12`, `lib/announcement-schema.ts:10` | Plain dates are read in the server's time zone (UTC in production), not the gym's. The audit log's date filter misses most of a day in Sydney, and an announcement "shown until" a date disappears at 10 or 11am that day. Found while fixing R-93. | PR 4 |
| R-109 | `app/admin/(console)/shifts/page.tsx:49` | An overnight shift ends 24 hours after the finish time on the start date, so a shift across a daylight-saving change is saved an hour out. Found while fixing R-22. | PR 4 |

## Low

| ID | Where | Problem | Closed by |
|---|---|---|---|
| R-70 | `lib/money.ts:22` | `applyDiscount` uses floating point (45c at 30% gives 31c, not 32c). | PR 4 |
| R-71 | `app/api/members/[id]/retry-payment/route.ts:16-19` | Every Stripe error is reported as "The card was declined again". | PR 4 |
| R-72 | `lib/billing/reminders.ts:24-37` | The reminder email is sent before its row is written, so overlapping runs send it twice; a query per member. | PR 4 |
| R-73 | `lib/billing/invoice.ts:40,49` | The invoice title uses today's GST registration, not the status when paid. | Open: needs GST status stored per payment; noted for when the setting changes |
| R-74 | `lib/shop/orders.ts:67` | Cancelling a pending order doesn't expire its Stripe Checkout session (the payment is still recorded and flagged). | PR 4 |
| R-75 | `lib/members/account.ts:151-167` | Erasure leaves the Stripe customer and subscription IDs on the anonymised row. | Open: they are kept deliberately to reconcile late Stripe events for kept payments (D-071); revisited in the final report |
| R-76 | `next.config.mjs:7` | The Content Security Policy allows any inline script. The only inline script is static. | Open: Next.js inlines its own scripts, so a hash-based policy would block the app; a nonce needs every page dynamic (D-093) |
| R-77 | `lib/auth/password.ts:10,17` | scrypt uses Node's default cost and doesn't store its parameters, so they can't be raised later. | PR 5 (parameters stored with new hashes; old hashes still verify) |
| R-78 | `lib/members/account.ts:16-18` | Sign-up reveals whether an email is already a member. | Open: accepted trade-off (D-062); the alternative needs email verification |
| R-79 | `lib/http/route.ts:58-66`, `app/api/iot/checkin/route.ts:14` | The body size limit is checked after reading the whole body; the door gateway route has no limit. | PR 5 |
| R-80 | `lib/http/route.ts:36-66` | The JSON content-type check uses `includes`, and routes without a body skip it; protection rests on the origin check and SameSite cookies. | PR 5 |
| R-81 | `lib/http/route.ts:93-101` | Foreign-key errors (P2003) become a 500; unexpected error messages (which can contain personal data) are logged verbatim. | PR 4 |
| R-82 | `lib/auth/session.ts:84` | The cookie's `Secure` flag depends on `NODE_ENV`. | PR 5 |
| R-83 | `lib/http/route.ts:104-111` | The query string is validated before authentication; path parameters aren't validated. | PR 5 |
| R-84 | `app/api/auth/login/route.ts` | Failed staff sign-ins aren't audited. | PR 6: recorded against the account with the reason (D-106) |
| R-85 | `app/api/shifts/route.ts:8` | A shift in progress disappears from "Who's rostered on" an hour after it starts. | PR 4 |
| R-86 | `lib/classes/service.ts:31,103,127` | Members can book a class up to an hour after it started; the waitlist ignores the booking window; staff can book cancelled or pending members; "finished" ignores the class length. | PR 4 |
| R-87 | `lib/membership/service.ts:297` | A condition that can never be true makes a scheduled plan change with no history event apply at once. | PR 4 |
| R-88 | `components/ui/scoreboard.tsx:24` | The "alert" colour is skipped only for the string "0", so "$0" owed is highlighted. | PR 4 |
| R-89 | `components/admin/staff-session.tsx:26` | Errors loading the staff session leave the menu empty with no message. | PR 4 |
| R-90 | `app/member/membership/page.tsx:258-276` | Plan and cancel dialogs keep errors from a previous attempt. | PR 4 |
| R-91 | `app/member/account/page.tsx:191` | After deleting an account the home page shows no confirmation. | PR 4 |
| R-92 | `app/admin/(console)/check-in/page.tsx:116` | The live region is created with the first result, so the first result often isn't announced. | PR 4 |
| R-93 | `app/admin/(console)/audit/page.tsx:172-181` | "Load more" failures are unhandled. | PR 4 |
| R-94 | `app/admin/(console)/retention/page.tsx:29`, `classes/page.tsx:282` | Lists capped at 500 members, sorted on the client. | Open: only matters above 500 members; noted |
| R-95 | `prisma/seed-data.ts:159,174,305` | Duplicate delete, a wrong comment, and seeded orders assigned to random buyers. | PR 4 |
| R-96 | `tests/integration/rbac.test.ts:205` | "Allowed" role checks accept a 500. | PR 4 |
| R-97 | `tests/global-setup.ts:9`, `tests/e2e/global-setup.ts:7` | A Prisma "AI consent" bypass variable is set (no effect on Prisma 5, risky after an upgrade). | PR 4 |
| R-98 | Several routes (see report) | Writes and their audit entries aren't in one transaction (inventory, shifts, agent actions, member create and update, check-in, class delete). | PR 5 |
| R-99 | Repo-wide | Dead exports: `formatDate`/`formatDateTime`/`formatTime` in `lib/dates.ts`, `STATUS_LABELS`, `isStripeConfigured`, `GST_RATE`, `formatPlanPrice`, `isLive`, `VisuallyHidden`, `POST /api/equipment`, `restockItems`. | PR 5 (POST /api/equipment kept, D-097) |
| R-100 | Repo-wide | Duplicated helpers: a day in milliseconds defined in many files and 26 inline literals; two date-formatting modules plus 23 ad-hoc formatters; `INV-` numbering written four times; status labels twice; plan-perks text three ways; `Interval` type three times; two near-identical invoice pages and sign-in routes; the revenue-visibility check repeated four times. | PR 5 |
| R-101 | Repo-wide | Route handlers query the database directly (about 60 files), so data access is spread out. | PR 5 |
| R-102 | `app/member/membership/page.tsx` (399 lines), `app/admin/(console)/classes/page.tsx` (356), `settings/page.tsx` (348), `prisma/seed-data.ts` (403) | Files too large to follow. | PR 5 |
| R-103 | `lib/` layout | Schemas in three styles (`lib/plans-schema.ts`, `lib/inventory/schema.ts`, `lib/classes/template-schema.ts`); labels split across `lib/client` and `lib/shop`; plans API split across `/api/admin/plans` and `/api/plans/[id]`. | PR 5 |
| R-104 | `package.json` | Inconsistent version pinning (exact versions, plus caret ranges for Prisma, Tailwind, TypeScript and Node types). Stripe 14, Prisma 5 and Next 15 are behind, with no known vulnerabilities. | PR 5 (pinning); Open for major upgrades (each changes behaviour and needs its own PR) |
| R-105 | Legacy schema | `enum Plan`/`Member.plan`, `PlanPrice`, `GymProfile`, and unused equipment prediction columns. | Open: removing columns is a destructive migration; listed for a later contract migration |
| R-106 | Various | Comments that narrate history ("now keyboard-safe"), misplaced doc comments in `lib/jobs/daily.ts`, magic numbers (low-stock 3, max quantity 20, at-risk 40, Stripe minimum 50c, checkout expiry). | PR 5 |
| R-107 | `lib/env.ts:18` | The Stripe key error message says only test keys are allowed, while live keys are refused by a separate check. | PR 5 |
