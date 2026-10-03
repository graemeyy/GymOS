# GymOS

The software an independent gym runs on. Staff manage members, plans, classes, check-in and payments; members manage their own membership. Built for Australian gyms: prices in AUD with GST included, tax invoices with an ABN, and cancellation rules set by the owner.

The gym's name, ABN, address, hours, plans and policies all live in one validated file, [`config/gym.config.json`](config/gym.config.json), so a new gym can adopt the app without code changes.

## Stack

Next.js 15 (App Router) and React 19, TypeScript (strict), Prisma 5 with PostgreSQL, Tailwind CSS 3 with design tokens, Zod for every input and environment variable, Stripe (test mode) for subscriptions, Vitest and Playwright with axe for tests. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) once it exists, [docs/DECISIONS.md](docs/DECISIONS.md) for why things are the way they are, and [docs/DESIGN.md](docs/DESIGN.md) for the design system.

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

Demo accounts from the seed, all with the password `ironbark-demo-2026`:

| Who | Email | Signs in at |
| --- | --- | --- |
| Owner | owner@example.com | /admin/login |
| Manager | manager@example.com | /admin/login |
| Front desk | frontdesk@example.com | /admin/login |
| Trainer | trainer@example.com | /admin/login |
| Member | charlotte.pham@example.com | /login |

To start again from scratch on a local database: `npm run db:seed -- --reset`. The seed refuses to run with `NODE_ENV=production`, never touches a database that already has members or staff, and only allows `--reset` against a local or test database.

On a fresh database without seed data, open `/admin/setup` to create the owner account.

### Stripe (optional, test mode only)

Payments work without Stripe keys; those actions answer "Payments aren't set up yet". To try them, use **test mode** keys from the Stripe dashboard:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...      # from `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
```

Live keys are refused at startup unless `STRIPE_ALLOW_LIVE_KEYS=true`.

## Checks

```bash
npm run lint          # ESLint, zero warnings allowed
npm run typecheck     # tsc --noEmit
npm test              # Vitest: unit tests and integration tests against Postgres
npm run build         # production build (doesn't touch any database)
npm run test:e2e      # Playwright + axe, against the production build
npm run check:config  # validate config/gym.config.json
```

Integration tests need a Postgres database whose name contains `test` (default `postgresql://gymos:gymos@localhost:5432/gymos_test`, override with `TEST_DATABASE_URL`). They reset it on every run. End-to-end tests use `gymos_e2e_test` (override with `E2E_DATABASE_URL`) and need `npm run build` first. If Chromium is already installed elsewhere, set `PLAYWRIGHT_CHROMIUM_PATH`.

CI (`.github/workflows/ci.yml`) runs all of the above on every pull request.

## Deploying

On Vercel, `vercel.json` sets the build command to `npm run vercel-build`, which applies migrations (`prisma migrate deploy`) before building. Plain `npm run build` never runs migrations, so a local build can't change a database by accident. Migrations are additive; each has a `down.sql` beside it for rollback.

Set the environment variables from `.env.example` in the hosting provider. `CRON_SECRET` enables the nightly retention job; `IOT_GATEWAY_SECRET` enables door scanners. Both endpoints refuse every request until their secret is set.

## Adopting GymOS for a new gym

1. Edit `config/gym.config.json`: brand, legal name, ABN, address, timezone, hours, plans and policies. Set `isDemo` to `false`.
2. Run `npm run check:config`. It explains anything that's wrong, such as an ABN whose check digits don't add up.
3. Have a lawyer review the membership terms and privacy policy. See [docs/COMPLIANCE-NOTES.md](docs/COMPLIANCE-NOTES.md).
4. Deploy, open `/admin/setup`, and create the owner account.
