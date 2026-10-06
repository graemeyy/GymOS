# GymOS

The software an independent gym runs on. Staff manage members, plans, classes, check-in, payments, the shop and announcements; members join online, manage their own membership, book classes, show a QR pass at the door and buy from the shop. Installable on a phone as a web app. Built for Australian gyms: prices in AUD with GST included, tax invoices with an ABN, and cancellation rules set by the owner.

The gym's name, ABN, address, hours, plans and policies all live in one validated file, [`config/gym.config.json`](config/gym.config.json), so a new gym can adopt the app without code changes.

## Stack

Next.js 15 (App Router) and React 19, TypeScript (strict), Prisma 5 with PostgreSQL, Tailwind CSS 3 with design tokens, Zod for every input and environment variable, Stripe (test mode) for subscriptions and shop payments, Vitest and Playwright with axe for tests. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together, [docs/DECISIONS.md](docs/DECISIONS.md) for why things are the way they are, and [docs/DESIGN.md](docs/DESIGN.md) for the design system.

## Run it locally

You need Node 20.9 or newer (22 recommended) and PostgreSQL 14 or newer.

```bash
npm install
cp .env.example .env            # then set SESSION_SECRET (openssl rand -base64 48)
createdb gymos_dev               # or point DATABASE_URL at any empty Postgres database
npm run db:migrate               # apply migrations
npm run db:seed                  # fictional demo data (only fills an empty database)
npm run dev                      # http://localhost:3000
```

Demo accounts from the seed. They all start with the same password, which isn't in the repository:

- Set `SEED_DEMO_PASSWORD` (10 characters or more) before `npm run db:seed` to choose it.
- Otherwise the seed makes a random one and prints it once in your terminal. It isn't saved anywhere, so note it down or re-seed.
- Each account must change it at its first sign-in before it can do anything else.

| Who | Email | Signs in at |
| --- | --- | --- |
| Owner | owner@example.com | /admin/login |
| Admin | admin@example.com | /admin/login |
| Manager | manager@example.com | /admin/login |
| Front desk | frontdesk@example.com | /admin/login |
| Trainer | trainer@example.com | /admin/login |
| Member (Unlimited plan, 10% shop discount) | charlotte.pham@example.com | /login |
| Member (Standard plan) | jack.osullivan@example.com | /login |
| Signed up online, no plan yet | oliver.brandt@example.com | /login |

To start again from scratch on a local database: `npm run db:seed -- --reset`. The seed refuses to run with `NODE_ENV=production`, never touches a database that already has members or staff, and only allows `--reset` against a local or test database.

On a fresh database without seed data, open `/admin/setup` to create the owner account. In production this needs `SETUP_TOKEN` (see Deploying).

### Stripe (optional, test mode only)

Payments work without Stripe keys; those actions answer "Payments aren't set up yet". To try them, use **test mode** keys from the Stripe dashboard:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...      # from `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
```

Live keys are refused at startup unless `STRIPE_ALLOW_LIVE_KEYS=true`.

Create the webhook endpoint with Stripe API version `2023-10-16`, the version the app is written against. Events with another version are still processed, and a warning is logged so the mismatch is noticed.

`npm run stripe:check` checks the keys are test mode and lists the webhook events the endpoint must send, without printing any key. Add `-- --remote` to also check the endpoint in your Stripe account. The events are listed in `lib/billing/events.ts`: checkout, subscription, invoice and refund events, including `charge.refund.updated` / `refund.updated` for refunds that fail later.

To test every payment flow on a deployed site, follow [docs/STRIPE-TESTING.md](docs/STRIPE-TESTING.md).

### Email (optional)

Set `RESEND_API_KEY` and `EMAIL_FROM` to send email through Resend: password reset links, email confirmation for online sign-ups, staff invitations, payment reminders, waitlist and announcement emails. Without a key, emails are skipped and logged.

Without email:
- Password reset and confirmation links are shown on screen instead, in development and on Vercel previews only, never on production (D-115).
- Staff invitation links are shown to the person who sent the invitation.
- Online sign-ups can't confirm their email, so they can't pay online until email is set up or staff start their membership at the desk (D-114).

## Checks

```bash
npm run lint          # ESLint, zero warnings allowed
npm run typecheck     # tsc --noEmit
npm test              # Vitest: unit tests and integration tests against Postgres
npm run build         # production build (doesn't touch any database)
npm run test:e2e      # Playwright + axe, against the production build
npm run check:config  # validate config/gym.config.json
npm run check:rollback  # every down.sql rolls back (needs ROLLBACK_DATABASE_URL, a test database)
npm run check:fresh-db  # a new database builds from migrations alone, seeds and is up to date (needs FRESH_DATABASE_URL, a test database)
```

Integration tests need a Postgres database whose name contains `test` (default `postgresql://gymos:gymos@localhost:5432/gymos_test`, override with `TEST_DATABASE_URL`). They reset it on every run. End-to-end tests use `gymos_e2e_test` (override with `E2E_DATABASE_URL`) and need `npm run build` first. If Chromium is already installed elsewhere, set `PLAYWRIGHT_CHROMIUM_PATH`.

CI (`.github/workflows/ci.yml`) runs all of the above on every pull request.

## Deploying

On Vercel, `vercel.json` sets the build command to `npm run vercel-build`, which applies migrations (`prisma migrate deploy`) before building. Plain `npm run build` never runs migrations, so a local build can't change a database by accident. Preview deployments (pull request branches) skip migrations, because a preview may point at the production database; set `ALLOW_PREVIEW_MIGRATIONS=true` only for a preview environment with its own database. Migrations are additive; each has a `down.sql` beside it for rollback.

Set the environment variables from `.env.example` in the hosting provider. `CRON_SECRET` enables the daily job (plan changes, pauses and cancellations falling due, payment reminders, timetable generation and retention scores); `IOT_GATEWAY_SECRET` enables door scanners. Both endpoints refuse every request until their secret is set. `SETUP_TOKEN` is required in production before `/admin/setup` will create the first owner account, so a stranger can't claim a fresh deployment; the setup form asks for it.

## Adopting GymOS for a new gym

1. Edit `config/gym.config.json`: brand, legal name, ABN, address, timezone, hours, plans and policies. Set `isDemo` to `false`.
2. Run `npm run check:config`. It explains anything that's wrong, such as an ABN whose check digits don't add up.
3. Have a lawyer review the membership terms and privacy policy. See [docs/COMPLIANCE-NOTES.md](docs/COMPLIANCE-NOTES.md).
4. Set `SETUP_TOKEN`, deploy, open `/admin/setup`, and create the owner account with the token.
