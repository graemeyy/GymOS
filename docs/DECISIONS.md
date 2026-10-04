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

**D-051. Shop orders follow a fixed set of transitions.** (PR 2) Pending, paid, ready for pickup or shipped, then collected or delivered. Stock is committed when an order is paid and returned when an unpaid order is cancelled. A paid order can't be cancelled from the order screen; the owner refunds the payment, which marks the order refunded and returns the stock. This keeps the money and the order in step.

**D-052. Supplement products show a guideline note and carry no app-written claims.** (PR 2) The product editor shows a note about TGA and Food Standards Code rules for supplement categories and warns (without blocking) when a description contains words like "cure", "treat" or "clinically proven". The owner writes every word of the description.

**D-053. Timetables are templates that generate classes.** (PR 2) A weekly template (day, time, length, capacity, trainer) generates real classes two weeks ahead. Generation is idempotent through a unique key on template and start time, so the daily job can run it every day. Editing a template doesn't change classes already generated; staff edit those individually.

**D-054. QR passes are signed tokens with a version.** (PR 2) A pass is `GYM1.` plus a signed token holding the member ID and a `qrVersion`. Reissuing a pass bumps the version, so a screenshot of an old pass stops working. The front desk scans with the browser's `BarcodeDetector` where available and can always type or paste the code.

**D-055. Staff roles are fixed, with one owner setting.** (PR 2) Owner, manager, front desk and trainer, with the permission map shown read-only in Settings. Custom roles would add a permissions editor the owner has to get right; four roles cover a small gym. Revenue visibility for front desk is a config switch.

**D-056. The audit log is filterable and exportable, and records who, what and when.** (PR 2) Every change to members, plans, payments, refunds, products, orders, staff and announcements is logged with the actor's name kept in the row, so the record survives staff being removed.

**D-057. Announcements email only members who opted in, and only once.** (PR 2) Members choose whether to receive announcement emails (`notifyAnnouncements`, default on for existing members). Publishing can send an email; a re-publish doesn't re-send unless the owner asks. Audience can be everyone, active members or a plan.

**D-058. Email goes through Resend's HTTP API and does nothing without a key.** (PR 2) No SDK dependency. Without `RESEND_API_KEY` sends are logged as skipped; tests capture messages instead of sending.

**D-059. All daily jobs run from the existing cron route.** (PR 2) `/api/cron/churn-shield` already had a Vercel cron entry and a secret. It now runs transitions, reminders, timetable generation, retention scoring and rate-limit clean-up. Renaming the route would mean changing the deployment's cron config, which this work doesn't touch.
