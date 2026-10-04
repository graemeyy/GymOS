# Decisions

Decisions made while building GymOS without stopping to ask, with the reason and what it would take to change each. Newest phase last. Each entry says which pull request introduced it.

## Process

**D-001. Three stacked pull requests on `claude/` branches.** (PR 1) Phase 1 is on `claude/clever-mayer-i0kufm` (the branch this session was assigned). Phase 2 branches from it as `claude/clever-mayer-i0kufm-owner`, and Phase 3 from that as `claude/clever-mayer-i0kufm-member`. Nothing is merged or deployed. Review and merge in order.

**D-002. The audit was written before any change.** (PR 1) `docs/AUDIT.md` and `docs/GAP-ANALYSIS.md` describe the code as it was at `3154a42`. They aren't updated as items are fixed; the PR descriptions say what was fixed.

## Platform and dependencies

**D-003. Next.js 15.5, not 14.2 or 16.** (PR 1) 14.1 had critical advisories, including the middleware authorisation bypass. 14.2.35 clears some but not all (several are only fixed in the 15.5 line). 16 is a bigger jump with less ecosystem support. 15.5.27 is the newest patched 15.x and needs React 19, so React moved to 19.2.8 (19.2.0 and earlier have the React Server Components advisory).

**D-004. Stripe SDK stays on v14 with API version `2023-10-16`.** (PR 1) Newer API versions moved `invoice.subscription` and changed several webhook payloads. Upgrading is worth doing, but separately and with real test-mode traffic, which this environment can't reach (`api.stripe.com` is blocked by the sandbox network policy).

**D-005. Prisma stays on v5.22, Tailwind on v3.4.** (PR 1) Both have newer majors. Neither upgrade fixes a vulnerability, and both would touch every file. The remaining `npm audit` findings (7 high) are all one `braces` advisory reached through Tailwind 3 and the Next ESLint plugin, both dev or build-time only; there is no fixed `braces` release. Production dependencies: 0 vulnerabilities.

**D-006. ESLint 9 flat config, called directly.** (PR 1) `next lint` is deprecated in 15.5 and was never configured. `npm run lint` runs `eslint . --max-warnings=0`, with `no-explicit-any` as an error.

**D-007. Vitest 5 and Playwright 1.56.1.** (PR 1) Vitest 1.x had critical advisories; 4.1.x crashes npm's resolver through its optional browser peer, so 5.0.3. Playwright is pinned to 1.56.1 because that matches the Chromium build preinstalled in this environment; `@axe-core/playwright`'s copy of `playwright-core` is pinned to the same version with an npm override.

**D-008. `npm run build` no longer runs migrations.** (PR 1) It used to run `prisma migrate deploy` against whatever `DATABASE_URL` was set, so a local build pointed at production changed production. Vercel now uses `npm run vercel-build` (set in `vercel.json`), which keeps the old migrate-then-build behaviour for real deploys.

**D-009. Environment variables are validated lazily, and once at startup.** (PR 1) `lib/env.ts` validates with Zod. `instrumentation.ts` calls it when the server starts, so a bad secret stops the server with a clear message. It isn't validated at import time because `next build` imports route modules without production secrets.

**D-010. One gym per deployment.** (PR 1) The brief describes one owner running one gym. Multi-tenancy (many gyms in one database) would add a tenant key to every table and every query. If GymOS becomes a hosted product for many gyms, that's a significant later change.

## Configuration

**D-011. Gym details live in `config/gym.config.json`, validated by Zod.** (PR 1) A JSON file rather than a TypeScript module so changing it isn't a code change, and rather than database rows so it's versioned, reviewable and validated at build time. It holds branding, legal name, ABN (with ATO check-digit validation), address, timezone, hours, the starting plan catalogue, and every owner policy (cancellation notice, cooling-off, pause limits, proration, failed-payment reminders, class booking rules, shop shipping, data retention). `npm run check:config` validates it.

**D-012. The shipped config is fictional and flagged `isDemo: true`.** (PR 1) "Ironbark Strength Co." in Marrickville is made up. The ABN `94 687 093 963` was generated randomly to pass the check digits; it isn't knowingly anyone's, but any valid ABN could be assigned to a real business, so it must be replaced before going live. (A first draft used a published ABN that belongs to a real organisation; it was removed before commit.)

**D-013. Plans move from a fixed enum to a `MembershipPlan` table, seeded from config.** (PR 1) The four hard-coded plans blocked every plan feature. The migration creates rows for the old four (keeping any price the owner had set) and points members at them. Config plans are created on seed if missing; the app never overwrites or deletes a plan the owner edited. The legacy `Plan` enum column and `PlanPrice` table stay so a rollback is lossless.

**D-014. Plan benefits are read from config in PR 1.** (PR 1) Class credits, guest passes, shop discount and guest rate are in the config plan entries. PR 2 moves them into the database so owners can edit them in the app.

**D-015. The old `GymProfile` table is no longer read.** (PR 1) Its name, address and timezone (which defaulted to New York) are superseded by config. The table stays for rollback.

## Money

**D-016. Integer cents, AUD, prices GST-inclusive, GST derived as 1/11 and stored.** (PR 1) Australians expect GST-inclusive prices (ACCC guidance on component pricing). GST on an inclusive amount is 1/11, rounded to the nearest cent. Each payment stores its GST so reports don't change if the rate or the rounding ever does. A gym that isn't GST-registered sets `gstRegistered: false` and GST is 0.

**D-017. Existing payment rows keep their original currency.** (PR 1) Rows created before this change say `usd`. They're displayed with their own currency code, not converted or relabelled. New rows default to `aud`.

**D-018. Billing supports weekly, fortnightly, monthly and yearly plans.** (PR 1) Australian gyms commonly bill weekly or fortnightly. MRR is a monthly equivalent (weekly × 52 ÷ 12).

**D-019. Dashboard MRR is an estimate from current plan prices.** (PR 1) It's labelled "Monthly revenue (est.)" with a note saying how it's calculated. PR 2's finance reports use actual payments.

## Security and access

**D-020. Permissions, not role ranks.** (PR 1) `lib/auth/permissions.ts` maps four roles (owner, manager, front desk, trainer) to 28 permissions, so what a role can do is readable in one table. Every staff route declares its permission through `staffRoute()`. Manager gets everything except staff accounts, plan pricing and gym settings. Front desk can check in, add members, book classes and adjust stock, but not change a member's plan or status, archive, refund, or see the audit log. Trainer sees classes and marks attendance.

**D-021. One signed cookie for staff and members, re-checked against the database on every API call.** (PR 1) The cookie (HMAC-SHA256, 12 hours, httpOnly, SameSite=Lax) carries a `sessionVersion`. Every API request loads the account and compares versions, so a deleted account, a role change, a password reset, an archived member, or a sign-out takes effect on the next request. The middleware only redirects signed-out page visits; it isn't relied on for security.

**D-022. Signing out signs out every device for that account.** (PR 1) With stateless tokens, revoking one device needs a session table. Bumping the version is simple and safe. If per-device sessions are wanted later, add a `Session` table and store its ID in the token.

**D-023. CSRF defence: same-origin check plus JSON-only bodies.** (PR 1) Mutating requests must come from this site's origin (or send no Origin, like a server-to-server call), must not be `Sec-Fetch-Site: cross-site`, and must send `application/json`, which a cross-site form can't do without a CORS preflight. No CSRF tokens.

**D-024. Rate limits are stored in Postgres.** (PR 1) In-memory counters don't work across serverless instances. One atomic upsert per request in a `RateLimit` table: login 10 per IP and 5 per account per 15 minutes, check-in 120 per minute, door gateway 600 per minute, bootstrap 5 per hour. Old rows aren't cleaned up yet (they're tiny); a cleanup can join the nightly job.

**D-025. The front-desk kiosk now needs a staff sign-in.** (PR 1) `/reception` and `/api/check-in` were public, and leaked member details to anyone who guessed an email. The kiosk is `/admin/check-in`; staff sign in on the front-desk device once (12-hour session).

**D-026. Refused check-ins aren't recorded as visits.** (PR 1) Before, a past-due or cancelled member's scan was still logged as a check-in and counted toward retention. Now refused scans go to the audit log only.

**D-027. Cron and door gateway secrets fail closed.** (PR 1) If `CRON_SECRET` or `IOT_GATEWAY_SECRET` isn't set, those endpoints answer 503 to everyone. Before, an unset secret made `Bearer undefined` a valid password.

**D-028. Archive replaces delete for members.** (PR 1) Deleting a member destroyed their payment history, which the gym must keep for tax (the ATO requires five years; config defaults to seven). Archiving cancels any Stripe subscription first (and stops if Stripe fails), releases future bookings, blocks sign-in, and keeps payments and visit history. Erasing personal details on a member's request (Privacy Act) is a separate step in PR 3.

**D-029. Webhooks are idempotent by Stripe event ID, and payments are unique by Stripe invoice ID.** (PR 1) The event ID is recorded in the same transaction as its effects, so a retry is a no-op and a failure rolls back both. `invoice.paid` and `invoice.payment_succeeded` for the same invoice still produce one payment row.

**D-030. Class bookings take a row lock on the class.** (PR 1) The old check-then-insert could overbook under concurrent requests. All booking, waitlist and promote paths now `SELECT ... FOR UPDATE` the class first. A test fires eight simultaneous bookings at one free spot and expects exactly one to succeed.

**D-031. Live Stripe keys are refused unless explicitly allowed.** (PR 1) The app only accepts `sk_test_`/`rk_test_` keys unless `STRIPE_ALLOW_LIVE_KEYS=true`. A gym going live sets that deliberately.

**D-032. New passwords need at least 10 characters.** (PR 1) Sign-in still accepts older 8-character passwords. No breached-password check yet.

**D-033. Content Security Policy allows inline scripts.** (PR 1) Next.js needs inline scripts unless every page uses a per-request nonce, which forces dynamic rendering. The policy blocks framing, third-party scripts, and connections to other origins. A nonce-based policy is a reasonable follow-up.

## Structure

**D-034. Staff console under `/admin`, member portal under `/member`, public pages at the root.** (PR 1) Old staff URLs (`/members`, `/classes`, `/radar`, `/reception` and so on) redirect permanently. `/radar` became Retention, `/iot` became Door access, `/billing` is labelled Payments.

**D-035. Pages stay as client components fetching the JSON API.** (PR 1) That was the existing pattern, and keeping it means one authorisation layer (the API) protects both the UI and any other client. No server actions, so there is no second, easily forgotten entry point to secure.

**D-036. Database identifiers keep US spelling; the UI uses Australian spelling.** (PR 1) Renaming the `CANCELED` enum value or the `Payout` table would be a riskier migration for no user benefit. Prisma's `@@map` exposes the table as `Payment` in code. Everything people read says "Cancelled", "Payments", "licence" and so on.

## Design

**D-037. A design system built from the gym floor.** (PR 1) See `docs/DESIGN.md`. In short: competition-plate blue for actions and plate yellow for the one highlight (the scoreboard), cool concrete neutrals instead of cream, Barlow Condensed (signage) for headings and numbers, and Atkinson Hyperlegible Next (designed for low-vision readers) for body text. Tailwind's palette, radii, shadows and type scale are replaced so only tokens exist. The existing warm "chalk and ember" palette was dropped because ember on cream is close to a recognisable generated-design default.

**D-038. The mobile menu behaviour is kept.** (PR 1) Same top bar, same left drawer, backdrop still closes it. Added: focus moves into the drawer and is trapped, Escape closes it, focus returns to the menu button, the page behind doesn't scroll, and the nav only renders links the role can use.

**D-039. The dark theme follows the device until the person chooses.** (PR 1) A small inline script sets the theme before first paint, so there's no flash of the wrong theme.

## Phase 2: owner features

**D-040. Plan benefits live in the database, seeded from config.** (PR 2) Class credits, guest passes, shop discount and the casual guest rate are columns on `MembershipPlan`. Config supplies the starting values for new plans only; once a plan exists, the owner edits it in the app and config never overwrites it. A plan that has members is archived, not deleted.

**D-041. Benefits are a ledger, not a counter.** (PR 2) Each grant, use, return or manual adjustment is a `BenefitLedger` row tied to a billing cycle, and the balance is the sum for the current cycle. That gives the owner a history ("who gave Jack two extra credits and why") and makes a rollover or reversal a new row rather than an edit. Unused credits don't roll over.

**D-042. A member's billing cycle comes from Stripe when there is a subscription, and otherwise rolls from the join date.** (PR 2) Webhooks store the subscription's current period. Members paid in cash or set up by staff get a rolling cycle on the plan's interval.

**D-043. Plan changes follow `policies.planChanges`.** (PR 2) Upgrades either charge the prorated difference now or wait for the next cycle; downgrades apply now or at the next cycle (default). Proration is by remaining time in the cycle, rounded to the cent, never negative (a downgrade doesn't produce an automatic credit; staff can refund if they choose).

**D-044. Cancellation respects cooling-off, notice and minimum term from config.** (PR 2) Within the cooling-off period a cancellation is immediate. Otherwise the end date is the later of the notice period and the end of the minimum term. Staff can override with a reason, which is logged. Nothing in the app says "no refunds" (see C-08).

**D-045. Pauses are validated against `policies.pause`.** (PR 2) Minimum and maximum length, no start in the past, and a limit per 12 months. A daily job applies pause starts, resumes, scheduled cancellations and pending downgrades, so state doesn't depend on someone opening a page.

**D-046. Failed payments get a grace period and owner-set reminders.** (PR 2) `pastDueSince` marks the start of an episode. Reminders go out on the days in `failedPayments.reminderDays`, at most once per day and per episode. Door and front-desk check-in keep working until `suspendAccessAfterDays` has passed. Staff can retry the failed invoice through Stripe.

**D-047. Refunds record GST pro rata and can't exceed what's left.** (PR 2) A partial refund carries the same share of the payment's GST. Stripe refunds use an idempotency key built from the payment, the amount already refunded and the amount, so a double-click can't refund twice; the update is guarded on the refunded total so concurrent refunds can't over-refund. Manual refunds (cash, bank transfer) are recorded without calling Stripe. `charge.refunded` webhooks reconcile refunds made in the Stripe dashboard.

**D-048. Tax invoice numbers are sequential database numbers.** (PR 2) An auto-increment column gives each payment a unique, gap-tolerant invoice number. The page shows the business's ABN, the GST amount and the title "Tax invoice" when `gstRegistered` is true; otherwise it is a "Receipt" with no GST. The buyer's name and email are always shown, which covers the extra requirement for sales of $1,000 or more.

**D-049. Finance reports only add up AUD, and use Australian periods.** (PR 2) Payments in any other currency are counted separately and shown as excluded, not converted. Periods offered: this month, BAS quarters (July to September and so on) and the financial year (1 July to 30 June), in the gym's time zone. Revenue is net of refunds; GST collected is net of refunded GST.

**D-050. CSV exports neutralise spreadsheet formulas.** (PR 2) Any cell starting with `=`, `+`, `-`, `@`, tab or carriage return gets a leading apostrophe, so a member called `=HYPERLINK(...)` can't run a formula in the owner's spreadsheet.

**D-051. Shop orders follow a fixed set of transitions.** (PR 2) Pending, paid, ready for pickup or shipped, then collected or delivered. Stock is committed when an order is paid and returned when an unpaid order is cancelled. A paid order can't be cancelled from the order screen; the owner refunds the payment. A full refund, from GymOS or the Stripe dashboard, marks the order refunded and puts the stock back if the goods hadn't been shipped or collected yet. A partial refund leaves the order as it is. This keeps the money and the order in step.

**D-052. Supplement products show a guideline note and carry no app-written claims.** (PR 2) The product editor shows a note about TGA and Food Standards Code rules for supplement categories and warns (without blocking) when a description contains words like "cure", "treat" or "clinically proven". The owner writes every word of the description.

**D-053. Timetables are templates that generate classes.** (PR 2) A weekly template (day, time, length, capacity, trainer) generates real classes two weeks ahead. Generation is idempotent through a unique key on template and start time, so the daily job can run it every day. Editing a template doesn't change classes already generated; staff edit those individually.

**D-054. QR passes are signed tokens with a version.** (PR 2) A pass is `GYM1.` plus a signed token holding the member ID and a `qrVersion`. Reissuing a pass bumps the version, so a screenshot of an old pass stops working. The front desk scans with the browser's `BarcodeDetector` where available and can always type or paste the code.

**D-055. Staff roles are fixed, with one owner setting.** (PR 2) Owner, manager, front desk and trainer, with the permission map shown read-only in Settings. Custom roles would add a permissions editor the owner has to get right; four roles cover a small gym. Revenue visibility for front desk is a config switch.

**D-056. The audit log is filterable and exportable, and records who, what and when.** (PR 2) Every change to members, plans, payments, refunds, products, orders, staff and announcements is logged with the actor's name kept in the row, so the record survives staff being removed.

**D-057. Announcements email only members who opted in, and only once.** (PR 2) Members choose whether to receive announcement emails (`notifyAnnouncements`, default on for existing members). Publishing can send an email; a re-publish doesn't re-send unless the owner asks. Audience can be active members, members on one plan, or staff only.

**D-058. Email goes through Resend's HTTP API and does nothing without a key.** (PR 2) No SDK dependency. Without `RESEND_API_KEY` sends are logged as skipped; tests capture messages instead of sending.

**D-059. All daily jobs run from the existing cron route.** (PR 2) `/api/cron/churn-shield` already had a Vercel cron entry and a secret. It now runs transitions, reminders, timetable generation, retention scoring and rate-limit clean-up. Renaming the route would mean changing the deployment's cron config, which this work doesn't touch.

**D-060. Preview deployments don't run migrations.** (PR 1, added after PR 2 opened) Vercel builds a preview for every pull request branch, and the build command runs `prisma migrate deploy`. If the preview environment shares the production `DATABASE_URL`, an unmerged branch could change the production schema. The migration script now skips unless `VERCEL_ENV` is `production` or `ALLOW_PREVIEW_MIGRATIONS=true`. A preview against an un-migrated database may show errors on new screens; that is the safe failure.

## Phase 3: member app and shop

**D-061. Online sign-up creates a member with no access until a plan starts.** (PR 3) A new status, `PENDING` ("Not started"), means signed up but not paying. Check-in, class booking and plan changes all refuse it. Paying through Stripe Checkout, or staff starting the plan at the desk, makes the member active. Adding an enum value is additive; `down.sql` turns any pending members into cancelled ones before restoring the old type.

**D-062. Sign-up never claims an existing email.** (PR 3) Many members were added by staff with no password. Without email verification, letting anyone "sign up" with that email would hand them someone else's account and payment history. The form says so and sends them to the front desk. Password reset and email verification by email are the follow-up (see the final report).

**D-063. Acceptance of the terms and privacy policy is recorded per document and version.** (PR 3) `LegalAcceptance` stores which version, when, and in what context (sign-up, checkout, re-acceptance). When the owner publishes a new version in config, members are asked once, in a banner. Members added by staff before online sign-up existed are asked the first time they use the app.

**D-064. Members self-serve only what they pay for online.** (PR 3) Plan changes from the member app go through the same service as staff changes, with the owner's proration and timing rules, and a preview that uses the same function as the change itself. Members billed at the front desk (no Stripe subscription) change plans there, because otherwise the new price would never be charged. Members can't choose "immediate" cancellation; the rules decide the date.

**D-065. The member timetable never shows other members.** (PR 3) It shows spots left, the waitlist length and the member's own position. Waitlist promotion emails can be switched off; the booking still happens and shows in the app.

**D-066. The QR pass is rendered on the server as an SVG, always black on white.** (PR 3) No QR library ships to the browser, and scanners read it in dark mode too. The pass shows even when the membership isn't active, because the scanner checks status at the door and the member needs to see why.

**D-067. The shop is public to browse and members-only to buy.** (PR 3) Guest checkout would need a second identity model, addresses without accounts, and separate privacy handling. Signing in also lets the discount apply automatically. The cart is kept in the browser (variant IDs and quantities only) and is cleared after a successful payment.

**D-068. Prices, discounts, shipping and GST are always worked out on the server.** (PR 3) The browser shows an estimate using the same pure pricing module (`lib/shop/pricing.ts`), but checkout ignores any price it sends. The member discount applies only while the membership is active. Each line goes to Stripe as one item at its discounted line total, so the amount charged equals the order total exactly.

**D-069. Stock is checked at checkout and taken when payment succeeds.** (PR 3) Reserving stock for abandoned checkouts would lock items up; instead the webhook takes stock once, in the same transaction as the payment record. If something sold out in between, the payment is still recorded and the order is flagged for staff to refund or restock, so a payment is never lost. Abandoned checkouts are cancelled when Stripe reports the session expired (30 minutes).

**D-070. Order emails are sent after the database commits.** (PR 3) The webhook collects emails to send and sends them once the transaction has succeeded, so a rolled-back event never emails anyone, and a retried one emails once. An email failure never makes Stripe retry. Order emails are transactional and go regardless of marketing preferences.

**D-071. Account deletion erases personal details but keeps financial records.** (PR 3) The member row stays as an anonymous owner of payments, refunds and orders (kept for tax), with name, email, password, notes, delivery addresses, future bookings and waitlist places removed, and audit log entries scrubbed of name and email. Deletion is blocked while a paid membership is running (cancel first, under the gym's rules) or while orders are in progress. Stripe customer records aren't deleted from GymOS; the owner handles requests that extend to Stripe.

**D-072. Data export includes staff notes.** (PR 3) Under APP 12, members can access personal information held about them, which includes notes staff write. The note field now tells staff that notes are included in a member's data download, and not to record health details without consent.

**D-073. Retention periods are enforced by the daily job.** (PR 3) Check-ins older than `checkInHistoryMonths` are deleted, and members archived for longer than `archivedMemberMonths` are anonymised the same way as a deletion request. This keeps the privacy policy's promises true.

**D-074. Email address changes go through the front desk.** (PR 3) Without verification, a typo would lock a member out, and a malicious change would redirect receipts. Members can change their name, preferences and password.

**D-075. The PWA is deliberately small.** (PR 3) A manifest, generated icons, and a service worker that caches built assets and shows an offline page. API responses and staff pages are never cached, because they're personal and must be current. Offline access to the pass was considered and left out: it would mean storing a live pass token in the browser cache.

**D-076. Legal pages are generated from config.** (PR 3) The terms and privacy policy read notice periods, cooling-off, pause limits, shop returns and retention periods from `config/gym.config.json`, so the documents and the app's behaviour can't drift apart. Until `legal.reviewedByLawyer` is true, both pages say they are templates.

**D-077. Local `--reset` seeding recreates plans from config.** (PR 3) Plans that existed before the Phase 2 migration have zero benefits (the migration can't read config). Real deployments keep their plans and the owner sets benefits in Plans; local and test databases now start from config.

## Review and clean-up

**D-078. The review, clean-up and permissions work is stacked on PR 3, not branched from `main`.** (PR 4, 5, 6) `main` still holds the original prototype; PRs 1 to 3 (open, unmerged) already replace most of it. Reviewing and rewriting `main` would redo that work and conflict with every open PR, and the permissions upgrade builds on the role system PR 1 introduced. So: PR 4 (bug fixes) is based on PR 3, PR 5 (rewrite to the standard) on PR 4, and PR 6 (permissions) on PR 5. Merge them in order. The review covers the codebase as it stands at the tip of PR 3.

**D-079. Invoice numbers on payments that existed before the Phase 2 migration are in storage order, not date order.** (Review R-67) The migration added `invoiceNumber` as `SERIAL NOT NULL`, which numbers existing rows as Postgres stores them. Numbers are unique, which is what the ATO requires; they just aren't chronological for old payments. Future columns like this are added nullable, backfilled in a defined order, then made required.

**D-080. Members added by staff start as "Not started" until someone with billing rights starts them.** (PR 4, R-36) Adding a member used to make them active straight away, with access and class credits, but no payment and no billing date. Now a new member is `PENDING`. If the person adding them can manage billing and picks a plan, the membership starts at once through the same service the front desk uses for "pay at the desk", which records the start date and the first billing date. Front-desk staff without billing rights can still add someone; a manager starts the membership.

**D-081. The member edit form only restores access; pausing and cancelling use the membership actions.** (PR 4, R-06) Setting the status to Paused or Cancelled in the edit form skipped the rules (notice, minimum term, pause limits) and left Stripe billing. The API now refuses those changes with a message pointing to the Membership panel. Setting a member back to Active still works: it marks a past-due member as paid at the desk, or starts a pending member's membership.

**D-082. Sign-in lockout counts failures per account and address, with a wider cap per account.** (PR 4, R-40, R-41) Counting every attempt against the account let anyone lock the owner out from anywhere, and a busy gym's shared Wi-Fi could block staff once members mistyped their passwords. Now: staff and member sign-ins have separate per-address limits; an account locks for an address after 5 failed attempts from it (successful sign-ins don't count); and an account locks everywhere after 50 failures from all addresses, which slows a distributed guessing attack without letting one person lock someone else out.

**D-083. First-run setup needs a setup token in production.** (PR 4, R-42) Whoever reached `/admin/setup` first on a fresh deployment became the owner. `SETUP_TOKEN` is now required in production: without it setup is refused, and with it the form asks for the token. Locally, the token is optional so `npm run dev` stays simple.

**D-084. Billing cycles, cooling-off and minimum terms count from when the membership started, in the gym's time zone.** (PR 4, R-07, R-29, R-30) They were counted from the account's creation date in UTC, so a member who signed up online and started paying weeks later had the wrong cycle and could lose their cooling-off period, and credits reset at 10 or 11am Sydney time. A new `membershipStartedAt` column holds the start (backfilled from the creation date for existing members). Monthly cycles return to the anchor day (31 Jan, 28 Feb, 31 Mar), and cycle boundaries are local midnights.

**D-085. Plain dates sent to the API mean whole days at the gym.** (PR 4, R-13, R-108) Pause dates, audit filters and announcement expiry dates arrive as `YYYY-MM-DD`. The server reads a start date as local midnight at the gym and an end date as the following local midnight (exclusive), whatever time zone the server or the browser is in. Full timestamps with an offset are still accepted.

**D-086. Cancelled classes are kept, not deleted.** (PR 4, R-05) Deleting a class removed its bookings, so credits spent on it were lost and the timetable job made the class again the next night. A cancelled class now keeps its row with `cancelledAt` set: bookings are cancelled, credits are returned, waitlisted members are told, and it's hidden from timetables. Generation skips any day that already has a class from the same slot, cancelled or not.

**D-087. Component tests run in jsdom next to the component.** (PR 4) The UI fixes needed tests that fail before and pass after, so Vitest now also runs `*.test.tsx` files beside components and pages, using jsdom and Testing Library. They mock `fetch` and Next's navigation hooks rather than starting a server; the Playwright tests still cover the real app.

**D-088. The service worker keeps one cache per build.** (PR 4, R-58) The page registers `/sw.js?v=<build ID>`. The build ID is the commit SHA on Vercel, otherwise the build time, so each deploy installs a new worker and deletes the previous build's cache instead of letting it grow on members' phones.

**D-089. Route handlers and pages never touch Prisma; lint enforces it.** (PR 5, R-101) Every query lives in `lib/<domain>/queries.ts` and every write in `lib/<domain>/service.ts`. ESLint refuses `@/lib/db` imports and `db.<model>` or `db.$transaction` calls under `app/` and `components/`. The one exception, the Stripe webhook route, now calls `processStripeEvent(event)`, which brings its own client.

**D-090. A change and its audit entry commit together.** (PR 5, R-98) Every write that logs an audit entry does both in one transaction, and `tests/integration/atomic-*.test.ts` proves each one by making the audit write fail. About forty routes were changed. Two results differ from before only when something fails part-way: adding a member whose chosen plan can't be started now creates nothing (it used to leave a "Not started" member behind with the same error), and a shop checkout whose final save fails now removes its pending order. Writes that are only an audit entry (exports, sign-ins) have nothing to roll back and stay as they were. Publishing an announcement with email can't be fully atomic, because the entry records how many emails went out; the claim-before-send rule (R-16) still stops double emails.

**D-091. The browser gets the gym config without Zod.** (PR 5, R-62) `lib/config/client.ts` exports the same JSON the server validates, typed but not parsed, because the schema has no defaults or transforms; a test checks the two match. This took Zod out of every client bundle (about 26 kB off the member pages). `lib/db.ts` and `lib/env.ts` import `server-only`, and a lint rule stops client and shared components importing server modules.

**D-092. Password hashes carry their scrypt cost.** (PR 5, R-77) New hashes are `scrypt$N$r$p$salt$hash`, so the cost can be raised later without breaking existing passwords. The cost stays at Node's default (N=16384, r=8, p=1), which is what existing hashes used; those still verify. Raising it is a one-line change to `COST` in `lib/auth/password.ts`.

**D-093. The Content Security Policy keeps `'unsafe-inline'` for scripts.** (PR 5, R-76 stays open) The review suggested a hash for the one inline script we write, but Next.js also inlines its own scripts on every page, with content that changes per page and build, so a hash-based policy would block the app. A nonce-based policy would work but needs middleware to make every page dynamic, losing static rendering. Revisit when Next supports nonces on static pages, or if the threat model changes.

**D-094. Requests are checked before they're read.** (PR 5, R-79, R-80, R-83) Bodies over the limit are refused from their declared length or as soon as reading passes it; the door gateway allows 4 kB and the Stripe webhook 1 MB. JSON means the exact media type, and a mutating request with a body must be JSON even on a route that takes none. Staff and member routes authenticate before validating the query, and path parameters that can't be an ID are a 404.

**D-095. `useMutation` is the one way to change data from the browser.** (PR 5, R-57) It allows one request in flight at a time, exposes `busy`, `error` and `fields`, and reports failures to an `onError` callback (usually a toast). Screens that redirect on success keep the button busy while the browser leaves. Lists where each row has its own action (booking classes, approving purchase orders) give each row its own mutation, so one row doesn't block another. The member email-preference switches now save one at a time; before, both could be sent at once.

**D-096. Shapes of API responses are pinned by snapshot.** (PR 5) Before moving queries out of route handlers, `tests/integration/characterisation.test.ts` recorded the keys and value types of every GET response (and the columns of every CSV) against seeded data. The snapshot didn't change during the rewrite. Values aren't pinned, because seed data is relative to today.

**D-097. The unused `POST /api/equipment` endpoint stays.** (PR 5, R-99) No screen calls it yet, but it's the only way to add equipment besides seeding, it's covered by the permission and atomic-write tests, and removing an API is a behaviour change. Everything else the review listed as dead was removed.

**D-098. Roles live in the database, and access is read from them on every request.** (PR 6) A `Role` table holds a name, a description and a list of permissions; each staff account points at one role. The migration creates five starting roles (Owner, Admin, Manager, Front desk, Trainer) with fixed ids and moves everyone across from the old fixed roles: Owner to Owner, Manager to Manager, Front desk to Front desk, Trainer to Trainer. Nobody becomes Admin automatically. The session cookie no longer carries a role; each request loads the person's role, so a change applies at their next click, and cookies issued before PR 6 keep working (the old role in them is ignored). An account with no role, or a deactivated one, is signed out. The old `Staff.role` column stays, kept in step with the nearest old role that gives no more access (Admin becomes Manager, custom roles become Front desk), so the migration's `down.sql` can put things back. The permission names are the eighteen in the brief (`docs/PERMISSIONS.md`); every route maps onto one of them, a list of them, or "any active staff member".

**D-099. Safeguards are enforced on the server, in the role and staff services.** (PR 6) There's always at least one active owner, checked under an advisory lock so two owners can't demote each other at once. Nobody can give a permission they don't hold, by editing a role, creating one, or giving someone a role. Nobody can change someone whose role is more powerful than theirs, and only an owner can give or take away the Owner role or touch an owner's account. Nobody can change their own role or deactivate themselves. The Owner role's permissions can't be edited (an owner always has everything). Preset roles can be edited but not deleted; a custom role can be deleted once nobody has it.

**D-100. The starting roles follow least privilege, which narrows what some people could do.** (PR 6) The brief defines the starting roles, and they differ from the old fixed roles in ways a gym will notice:
- Front desk can no longer add or edit members, write notes, reissue passes or record keycards (no "Add and change members"), and doesn't see revenue or members' email, notes and payments. It keeps check-in, bookings, attendance, shop orders and stock counts. A gym that wants the desk to add members turns "Add and change members" on for Front desk on the Roles page.
- Manager can no longer create products, change product prices or download finance reports (they need "Change prices" and "Download finance reports", which only Owner and Admin have).
- Trainer no longer sees every member: only their own classes and the members booked into them (R-33, D-105).
- The old split between editing a member's details (front desk) and their plan and status (billing) is gone: "Add and change members" covers both, and status still only changes through the membership actions. A member added with a plan by someone with that permission starts straight away, as a manager's did before (R-36); without a plan they start pending.

**D-101. "Hide revenue from front desk" is replaced by the "See money" permission.** (PR 6) The switch only ever affected the Front desk role, and the new Front desk role doesn't see money at all unless someone turns "See money" on. The switch is gone from Settings. Its database column stays (removing it isn't needed to fix anything) and the API still accepts it, but it has no effect.

**D-102. Prices need "Change prices" on top of editing the plan or product.** (PR 6) Changing a plan's price, billing interval or guest rate, creating a plan or a product, adding a product variant, or changing a variant's price needs `prices.edit`. Everything else about plans needs `plans.edit` and about products `products.edit`. The server refuses with "Only admins can change prices." against the field, and screens show prices read-only with "Only admins can change this" rather than hiding them. Settings work the same way with `settings.edit`.

**D-103. Staff are invited by email and deactivated rather than deleted.** (PR 6) Staff accounts used to be created with a temporary password typed by the owner, and could be deleted. Now someone with `staff.manage` invites a person with a role; the email links to a page where they set their own password. The link is random, stored only as a SHA-256 hash, works once and expires after 7 days; resending replaces it. Without email configured, the link is shown to the inviter to pass on in person, so a gym without email can still add staff. Deactivating signs the person out and blocks sign-in but keeps the account, so their name stays on the audit log, classes and shifts; it can be reversed. `POST /api/staff` and `DELETE /api/staff/:id` are gone; `POST /api/staff/invite`, `POST /api/staff/:id/invite` and `PUT /api/staff/:id` (name, role, active) replace them. The rollback deletes accounts that never accepted their invitation, because the old schema needs a password.

**D-104. Owner-only actions are named now, even where no screen exists yet.** (PR 6) The brief's owner-only actions are managing the gym's billing account with GymOS, payouts and deleting the gym's data. GymOS has none of these screens, so they are listed on the Roles page and in `docs/PERMISSIONS.md` as owner-only for when they're built, rather than invented now (no new features). Transferring ownership is giving or taking away the Owner role, which only an owner can do (D-099).

**D-105. Members' private details are redacted, not refused.** (PR 6, R-33) Email, staff notes, payments and amounts owing need `members.view_sensitive`. Without it, member records come back with those fields as `null` (screens show nothing or "hidden"), rather than the whole request failing, so the member list and check-in still work. Payments on a member also need `finance.view`. Searching members by email needs the same permission, so the search can't confirm whether an address is a member's. Notes are refused outright without it. A staff member who can't see members, bookings or the timetable sees only their own classes, with booked members' names, and marks attendance only for their own classes. Trainer pickers list every active staff member with their role, because with custom roles there's no fixed "trainer" role to filter on.

**D-106. The audit log keeps old and new values.** (PR 6, R-84) Audit entries gained `before` and `after` JSON columns, filled for every change to prices, plans, products, settings, roles and staff accounts, and for refunds (including refunds made in the Stripe dashboard). Price changes are their own actions (`plan.price_changed`, `product.price_changed`) so they're easy to find. The audit page shows what changed, filters by person as well as area and dates, and the CSV export has "Old value" and "New value" columns. Failed staff sign-ins are recorded against the account as a system entry, "Sign-in attempt", with the reason (wrong password, deactivated, locked); attempts with an email that isn't a staff account aren't recorded, because that's no one's data. Entries from before PR 6 have no old or new values.

**D-107. A route can need any one of several permissions.** (PR 6) Stock and equipment lists used to need their own read permissions, which the brief's list doesn't have. Rather than open them to every staff member (Trainers couldn't see them before), those routes need "Handle shop orders" or "Edit products, stock and equipment", so the same people as before can see them. `staffRoute` takes one permission, a list meaning any of them, or `null` for any active staff member.

**D-108. Read-only screens stay open to every staff member where nothing private is on them.** (PR 6) The schedule, timetable, shift roster, announcements, plans list and the Roles page are visible to any active staff member, so everyone can see what's on and what their role allows. Anything about money on those screens (dashboard revenue, plan member counts) still needs `finance.view`.
