# Tenancy: one copy per gym, or one app for many gyms

GymOS is meant to be run by different gyms and gym chains, each under its own brand. There are two ways to do that. This document compares them, recommends one for now (D-123), and lists exactly what would have to change to move to the other later.

A **gym** here is one business: one ABN, one Stripe account, one set of members. A gym chain with several sites is still one gym with several **locations** (see Part 2 and D-125). Locations are inside a copy; tenancy is about separating businesses.

## The two options

**A. One copy per gym (recommended for now).** Each gym gets its own Vercel project, its own Postgres databases (Production and Preview), its own Stripe account, its own email domain and its own custom domain. The code is the same; the copy is configured with environment variables, then branded and set up from the staff console.

**B. One shared multi-gym app.** One deployment and one database serve every gym. Each row belongs to a gym (`gymId`), every query is filtered by it, and the gym is chosen from the domain (`members.gym-one.example` versus `members.gym-two.example`). Payments go through Stripe Connect, with each gym as a connected account.

## Comparison

| | A. One copy per gym | B. One shared app |
|---|---|---|
| **Data separation** | Complete. Each gym's members are in their own database; a bug in one query can't show another gym's members. | Depends on every query including `gymId`. One missed filter leaks another business's members. Needs Postgres row-level security as a second line of defence. |
| **Privacy Act and contracts** | Each gym is the data controller for its own database, which matches how they'll think about it. A data request or breach affects one gym. | GymOS's operator holds every gym's data and becomes a processor for all of them. One breach affects every gym. |
| **Payments** | Each gym's own Stripe account and keys. Payouts, disputes, GST and refunds are theirs. No platform fees or Connect onboarding. | Stripe Connect. GymOS becomes a platform: onboarding each gym, platform terms, possibly application fees, and liability for connected accounts. Webhooks arrive for every gym on one endpoint. |
| **Branding** | Branding is per copy (Part 1): name, logo, colours, fonts, app name, emails. | The same branding, but chosen per request from the domain, and every cached page and email must carry the right gym's brand. |
| **Domains and email** | Each copy has its own domain and sending domain, set once in Vercel and Resend. | Many custom domains on one project, plus per-gym sending domains in one Resend account. |
| **Upgrades** | Each copy is deployed separately. With many gyms, upgrades need automation (one GitHub repo, many Vercel projects tracking `main`, or a release branch). A bad migration affects one gym at a time. | One deploy upgrades everyone at once. A bad migration affects everyone at once. |
| **Cost** | One Vercel project and two databases per gym. Fine for a handful of gyms; adds up past dozens. | Shared infrastructure; cheaper per gym at scale. |
| **Customisation** | A gym can be held on an older release, or given a feature flag, without affecting others. | Every gym runs the same release. |
| **Cross-gym features** | None (no shared logins, no network-wide passes). | Possible: one member account across gyms, network passes, platform-wide reporting. |
| **Work needed now** | Little: the app is already single-gym. Branding (Part 1), locations (Part 2), import (Part 3) and a setup checklist (Part 4). | Large: see "What would need to change" below. |
| **Operations** | Per gym: secrets, cron, backups, monitoring. Part 4's check script makes each copy's set-up checkable. | Once for everyone, but a shared outage takes every gym down. |

## Recommendation (D-123)

**One copy per gym, for now.** The reasons, in order:

1. **Separation is structural, not a discipline.** Today there is no `gymId` anywhere and no query has to remember one. Leaking one gym's members to another isn't possible in this model.
2. **Payments stay simple and the gym's own.** Each gym signs up to Stripe itself, keeps its own payouts and disputes, and GymOS never becomes a payments platform. Moving to Stripe Connect is a business decision (platform terms, fees, liability), not just code.
3. **The work is small and useful either way.** Branding in the database, locations, import and the setup checklist are all needed for option B too.
4. **The number of gyms is small.** The costs of option A (one project and two databases per gym, per-copy upgrades) only matter at dozens of gyms.

Revisit when any of these is true: more than about 20 gyms, gyms asking for shared member accounts across businesses, or per-copy upgrades taking more than an hour a release.

## Running many copies well (what option A needs)

- **One codebase.** Every copy deploys the same repository. Gym-specific things live in the copy's environment variables, its database (branding, plans, settings) and `config/gym.config.json` defaults, never in code. A CI test fails if the demo gym's name or brand text appears outside config and seed files (D-124).
- **Releases.** Each Vercel project tracks `main` (or a `release` branch once there are several gyms), so merging releases to every copy. Migrations are additive (D-120), so copies can be upgraded one at a time.
- **Setup.** docs/NEW-GYM-SETUP.md is the checklist, and `npm run check:setup` reports what a copy is missing without printing secrets.
- **Isolation of secrets.** Each copy has its own `SESSION_SECRET`, `SETUP_TOKEN`, `CRON_SECRET`, Stripe keys and webhook secret. A session from one gym's copy is useless at another.

## What would need to change to go multi-tenant later

In order. Everything here is additive until the last step.

1. **A `Gym` table, and `gymId` on every gym-owned table.** That's every model except `RateLimit` and `StripeEvent` (which get it too, since their keys must not collide across gyms). The default-gym migration follows the same pattern as the default-location migration in Part 2: create one gym, point every row at it, then make the column required.
2. **Unique keys become per gym.** Member and staff emails, plan slugs, product slugs, invoice numbers (`Payment.invoiceNumber` is a global sequence today; it becomes per gym, e.g. a counter on `Gym`), order numbers and location names. The same person could then be a member of two gyms with one email.
3. **Every query filters by gym.** The data-access layer is already in one place per domain (`lib/<domain>/queries.ts` and `service.ts`, CODE-STANDARDS section 2), so the filter goes there, taken from the request's gym rather than a parameter callers can forget. Add Postgres row-level security keyed on a per-transaction `app.gym_id` setting as a backstop.
4. **Resolve the gym from the request.** Middleware maps the host name to a gym (with a cache), and puts it on the request. Sessions carry `gymId`, and a session for one gym is refused on another's domain.
5. **Singletons become per gym.** `GymSettings`, `GymProfile` and the branding row (Part 1) use the gym's ID instead of `"singleton"`. `config/gym.config.json` stops being the business's details and becomes defaults for new gyms.
6. **Stripe Connect.** Each gym connects its Stripe account through onboarding. Every Stripe call passes the gym's connected account (`stripeAccount`), webhooks are Connect webhooks routed by `event.account`, and the Stripe customer and subscription IDs are unique per account. Platform terms and any application fee need a lawyer and an accountant.
7. **Email per gym.** Each gym verifies its own sending domain in Resend; `EMAIL_FROM` becomes per gym. Unsubscribe links (D-118) and every email link use the gym's domain.
8. **Cron per gym.** The daily job loops over gyms, each in its own timezone (renewals, reminders, timetable generation and retention scores are all "today" in the gym's timezone).
9. **Domains.** Custom domains are added to one Vercel project through Vercel's domains API, with certificates managed by Vercel.
10. **Staff across gyms.** Decide whether a person can work at two gyms with one login. If so, `Staff` becomes a person plus a membership of each gym with a role there.
11. **Data rights per gym.** Exports, erasure, retention periods and audit logs are already per member; they become per gym, and the operator needs a data processing agreement with each gym.
12. **Moving the existing copies in.** Each copy's database is imported into the shared one under a new `gymId`, with IDs kept (they're CUIDs, so they don't collide). Stripe customers move only if each gym's existing account is connected as is.
13. **Tests.** A cross-tenant test suite: every route called as gym A's staff and members must never return or change gym B's rows, the same way `tests/integration/rbac.test.ts` checks permissions today.

Steps 1 to 5 are a few weeks of careful work; step 6 is a project of its own. None of it is started by this decision, and nothing in Parts 1 to 4 makes it harder.
