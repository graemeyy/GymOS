# Gap analysis (Phase 0)

Baseline: commit `3154a42`, 3 October 2026. **Exists** means it works end to end today. **Partial** means some of it is there, with the gap noted. **Missing** means nothing usable exists.

## Owner and staff

| Feature | Status | What's there | What's missing | Files |
| --- | --- | --- | --- | --- |
| Dashboard: active members | Exists | Count of `status = ACTIVE` | | `app/api/dashboard/stats/route.ts`, `app/page.tsx` |
| Dashboard: new sign-ups | Missing | | Count by period | |
| Dashboard: cancellations and churn | Missing | Retention scores only (a prediction, not churn) | Cancellations by period, churn rate | `app/radar/page.tsx` |
| Dashboard: MRR | Partial | "Monthly revenue" = list price × active members | Real MRR from active subscriptions at their actual price, excluding paused and past due | `app/api/dashboard/stats/route.ts:18` |
| Dashboard: failed payments | Missing | Members flip to `PAST_DUE` via webhook | Count, list, amount at risk | `app/api/webhooks/stripe/route.ts:63` |
| Dashboard: check-ins | Exists | Check-ins today, recent list | Trend over time | `app/page.tsx` |
| Dashboard: revenue by plan and product | Missing | | | |
| Members: search and filter | Partial | Client-side search by name or email | Filter by status and plan, server-side search for large lists | `app/members/page.tsx:96` |
| Members: profile | Partial | Read-only detail page | Contact details, emergency contact, editable profile | `app/members/[id]/page.tsx` |
| Members: status (active, paused, past due, cancelled) | Partial | Enum with all four, set freely in the edit form | Transitions driven by rules and Stripe instead of a free dropdown | `prisma/schema.prisma:19` |
| Members: notes | Missing | `Member.notes` column, unused | UI and API, a note history with author | `prisma/schema.prisma` |
| Members: manual adjustments | Missing | | Credit or debit adjustments (class credits, guest passes, account balance) with reason and audit | |
| Members: freeze | Missing | Status can be set to `PAUSED` by hand | Pause with start/end dates, Stripe `pause_collection`, rules from config | |
| Members: cancel and resume | Partial | Status can be set to `CANCELED`; deleting a member cancels the Stripe subscription | Cancel at period end or with notice period per config, resume, no hard delete | `app/api/members/route.ts:108` |
| Plans: configurable tiers and pricing | Partial | Four fixed enum plans, owner edits monthly price | Plans as data (add, rename, archive), billing interval, joining fee, minimum term | `app/api/settings/plan-prices/route.ts`, `lib/pricing.ts` |
| Plans: perks (class credits, guest passes, shop discount, guest rates) | Missing | | Per-plan benefits and usage tracking | |
| Plans: plan changes with proration rules | Missing | | Upgrade and downgrade with configurable proration | |
| Billing: Stripe subscriptions | Partial | Checkout session (USD) and webhook, but no UI calls checkout | AUD, GST-inclusive prices, Stripe prices per plan, member-facing flow | `app/api/checkout/route.ts`, `app/api/webhooks/stripe/route.ts` |
| Billing: failed-payment handling (retry and reminders) | Partial | `invoice.payment_failed` sets `PAST_DUE` | Attempt tracking, reminder emails, recovery back to active, staff view | `app/api/webhooks/stripe/route.ts:63` |
| Billing: refunds | Missing | | Refund via Stripe, record against the payment, flow into finance | |
| Billing: invoices and receipts with GST and ABN | Missing | | Tax invoice with ABN, GST amount and invoice number | |
| Finance: revenue by plan, product and period | Missing | List of recent "payouts" | Reports | `app/billing/page.tsx` |
| Finance: refunds | Missing | | | |
| Finance: outstanding balances | Missing | | | |
| Finance: GST summary | Missing | | | |
| Finance: CSV export (labelled as summary, not tax advice) | Partial | CSV of recent payments | Proper report exports with the label | `app/billing/page.tsx:47` |
| Shop admin: products with variants | Missing | `InventoryItem` is back-of-house stock (no retail price, no variants) | Products, variants (size, colour, flavour), images | `app/inventory/page.tsx` |
| Shop admin: stock levels | Partial | Atomic stock adjustment on inventory items | Stock per variant, tied to orders | `app/api/inventory/[id]/route.ts` |
| Shop admin: pricing | Missing | Unit cost only | Retail price (GST inclusive) | |
| Shop admin: categories (apparel, supplements) | Partial | Free-text category on inventory items | Fixed product categories with supplement handling | |
| Shop admin: order management (paid, packed, ready for pickup, shipped, refunded) | Missing | | | |
| Classes: timetable | Partial | One-off classes listed by start time | Weekly timetable view, recurring templates | `app/classes/page.tsx` |
| Classes: capacity | Exists | Capacity enforced | Concurrency race (audit S14) | `app/api/classes/[id]/book/route.ts` |
| Classes: waitlist | Exists | Join, remove, promote | Automatic promotion on cancellation | `app/api/classes/[id]/waitlist/*` |
| Classes: bookings | Exists | Staff book members | Member self-booking (member side) | |
| Classes: attendance | Exists | Attended / no-show | | `app/api/classes/[id]/book/route.ts` PATCH |
| Classes: trainers | Partial | Free-text `instructor` | Link to staff with the trainer role | `prisma/schema.prisma` `Class.instructor` |
| Check-in: QR pass scanning at the front desk | Partial | Kiosk with typed ID or email (public, leaks data); IoT endpoint | Signed QR pass, camera scanning, staff-only scan screen | `app/reception/page.tsx`, `app/api/check-in/route.ts` |
| Staff: roles (owner, manager, trainer, front desk) | Partial | Owner, manager, front desk | Trainer role | `lib/roles.ts` |
| Staff: permissions | Partial | Rank-based checks on mutations | Checks on reads; permission map per action | `lib/auth.ts` |
| Staff: audit log of sensitive actions | Exists | Most mutations logged, last 100 shown | Filters, pagination, money actions (refunds) | `lib/audit.ts`, `app/settings/page.tsx` |
| Announcements to members | Missing | | | |

## Members

| Feature | Status | What's there | What's missing | Files |
| --- | --- | --- | --- | --- |
| Sign-up and onboarding with plan selection | Missing | | Member accounts, plan picker, Stripe checkout | |
| Membership terms and cancellation acceptance | Missing | | Terms shown and accepted (versioned, timestamped) | |
| My membership: plan and next billing date | Missing | | | |
| My membership: benefits and usage | Missing | | | |
| My membership: upgrade and downgrade | Missing | | | |
| My membership: pause and cancel by owner's rules | Missing | | | |
| My membership: update card via Stripe customer portal | Partial | `/api/billing-portal` exists, but is unused, unauthorised and returns to a 404 | Member-authorised access to their own portal only | `app/api/billing-portal/route.ts` |
| Class booking, cancellation and waitlist | Missing (member side) | Staff can do it for them | Self-service | |
| QR check-in pass | Missing | | | |
| Shop: browse, cart, checkout | Missing | | | |
| Shop: member discount applied automatically | Missing | | | |
| Shop: order history and tracking status | Missing | | | |
| Profile | Missing | | | |
| Notification preferences | Missing | | | |
| Data export (Privacy Act) | Missing | | | |
| Account deletion (Privacy Act) | Missing | Staff hard delete only (destroys payment records, audit S8) | Member-requested deletion that keeps legally required records | |

## Platform items from the brief

| Item | Status | Notes |
| --- | --- | --- |
| Env validation with Zod and `.env.example` | Missing | |
| Input validation with Zod | Missing | Hand-rolled checks |
| Stripe webhook signature verification | Exists | `constructEvent` is used. Idempotency is missing (audit S6) |
| RBAC on every route and action | Partial | Mutations only (audit S4) |
| Seed script with fictional data | Partial | Fictional, but destructive (audit S7) |
| Vitest | Partial | Runs, `lib/` only |
| Playwright | Missing | |
| CI (lint, type-check, tests, build) | Missing | |
| README with setup instructions | Missing | |
| Single validated gym config (branding, ABN, address, hours, plans, policies) | Missing | Split across `GymProfile`, `GymSettings` and code constants |
| PWA (installable) | Missing | |
| Privacy Policy and Terms templates | Missing | |
| Email (Resend) | Missing | |
