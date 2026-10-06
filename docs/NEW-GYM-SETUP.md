# Setting up GymOS for a new gym

Each gym runs its own copy of GymOS: its own Vercel project, databases, Stripe account, email domain and web address, all from the same code (D-123, [TENANCY.md](TENANCY.md)). A chain with several sites is one copy with several locations.

Work through this list in order. Each step says what to do and how to tell it's done. At the end, `npm run check:setup` checks the copy is fully configured and lists anything missing, without printing any secret.

Allow about two hours, plus however long DNS takes for the domain and email.

## What you need first

- [ ] The gym's legal name, ABN, contact email and phone, street address and timezone.
- [ ] Its plans: names, prices including GST, billing interval and what each includes.
- [ ] Its policies: cancellation notice, pauses, plan changes, failed payments, class booking and cancellation, and shop returns.
- [ ] The membership terms and privacy policy, reviewed by a lawyer ([COMPLIANCE-NOTES.md](COMPLIANCE-NOTES.md)).
- [ ] The person who'll be the owner in GymOS, with an email address they read.
- [ ] Access to the gym's domain name settings (DNS).
- [ ] If moving from another system: exports of plans, members and memberships as CSV files.

## 1. The gym's details

- [ ] Fork or copy the GymOS repository for this gym. Each gym's details live in its own copy.
- [ ] Edit `config/gym.config.json`: the business details, timezone, hours, starting plans and policies. Set `isDemo` to `false`.
- [ ] Run `npm run check:config`. It explains anything that's wrong, such as an ABN whose check digits don't add up.

The brand fields in the config are only defaults. The owner sets the real name, logo, colours and fonts on the Branding page later, without a redeploy.

## 2. Vercel project

- [ ] In Vercel, create a new project from this gym's repository. Use one project per gym; never point two gyms at one project.
- [ ] Leave the build settings alone. `vercel.json` sets the build command (`npm run vercel-build`, which applies database migrations on production deploys only) and the daily job.
- [ ] Don't deploy yet: the environment variables come first.

## 3. Databases: separate Production and Preview

Production holds the gym's real members, so nothing else may touch it.

- [ ] Create two PostgreSQL databases, for example with Neon or Supabase in the Sydney region: one for **Production** and one for **Preview**.
- [ ] Never seed the Production database. `npm run db:seed` creates demo accounts with example.com addresses; `check:setup` fails if it finds them.
- [ ] Set `DATABASE_URL` separately for each Vercel environment (step 4): the Production database for Production, and the Preview database for Preview.
- [ ] Preview deployments don't run migrations unless you set `ALLOW_PREVIEW_MIGRATIONS=true` on **Preview only**, and only when Preview has its own database. Never set it while Preview points at Production's database.
- [ ] Turn on the provider's automatic backups for the Production database and note how to restore one.

## 4. Environment variables

Set these in Vercel under Project Settings, Environment Variables. Set each one for **Production**, and for **Preview** with Preview's own values where they differ. `.env.example` describes each one. Never commit real values to the repository.

| Variable | Required | What it is | How to get it |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | The database connection string | From the database provider; different for Production and Preview |
| `SESSION_SECRET` | Yes | Signs sign-in sessions and passes | `openssl rand -base64 48`; different for Production and Preview |
| `NEXT_PUBLIC_APP_URL` | Yes, once the domain is set up | The address in emails and Stripe redirects | The custom domain from step 7, such as `https://members.yourgym.com.au` |
| `STRIPE_SECRET_KEY` | Yes | The gym's Stripe secret key | Step 5. Test-mode key (`sk_test_`) until the gym is ready to take money |
| `STRIPE_WEBHOOK_SECRET` | Yes | Proves webhook events come from Stripe | Step 5 |
| `STRIPE_ALLOW_LIVE_KEYS` | Only for live keys | Must be `true` for a live key to be accepted | Set it on Production when switching to live keys |
| `RESEND_API_KEY` | Yes | Sends email | Step 6 |
| `EMAIL_FROM` | Yes | Who email comes from, such as `Your Gym <hello@yourgym.com.au>` | An address on the domain verified in step 6 |
| `CRON_SECRET` | Yes | Lets Vercel run the daily job | `openssl rand -base64 32` |
| `SETUP_TOKEN` | Until the owner account exists | Needed to create the first owner | `openssl rand -base64 24`. Remove after step 8 |
| `IOT_GATEWAY_SECRET` | Only with door scanners | Lets door scanners record check-ins | `openssl rand -base64 32`; give it to the scanner installer |

Never set `SHOW_EMAIL_LINKS` on a deployment: it's for local test builds only.

## 5. Stripe account and webhook

The gym has its own Stripe account, so payouts go to the gym's bank account and GymOS never holds anyone's money.

- [ ] The gym creates (or already has) a Stripe account in its own name, with its ABN and bank account.
- [ ] With **Test mode** on, copy the secret key into `STRIPE_SECRET_KEY`.
- [ ] Under Developers, Webhooks, add an endpoint for `https://<your domain>/api/webhooks/stripe`. Run `npm run stripe:check` to see the API version and the exact list of events it must send. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] After deploying, run `npm run stripe:check -- --remote --url https://<your domain>` with the test key in your local `.env`. It confirms the endpoint sends every event GymOS needs.
- [ ] Run through [STRIPE-TESTING.md](STRIPE-TESTING.md) with test cards.
- [ ] **Going live:** when the gym is ready to take real money, repeat this step with Test mode off: a live key, a new webhook endpoint and its signing secret, and `STRIPE_ALLOW_LIVE_KEYS=true`, on Production only. Keep test keys on Preview.

Card details never pass through GymOS: members enter them on Stripe's own pages.

## 6. Email domain

- [ ] Create a Resend account for the gym and add its domain (or a subdomain such as `mail.yourgym.com.au`).
- [ ] Add the DNS records Resend shows (SPF, DKIM and the return path) at the gym's DNS provider, and wait for Resend to say the domain is verified.
- [ ] Create an API key with sending access and put it in `RESEND_API_KEY`.
- [ ] Set `EMAIL_FROM` to an address on that domain, such as `Your Gym <hello@yourgym.com.au>`. The name part can be changed later on the Branding page; the address must stay on the verified domain.
- [ ] After deploying, use "Forgot password" on the sign-in page with your own email and check the email arrives and isn't marked as spam.

## 7. Custom domain

- [ ] In Vercel, under Project Settings, Domains, add the address members will use, such as `members.yourgym.com.au`.
- [ ] Add the DNS record Vercel shows (usually a CNAME) and wait for the certificate.
- [ ] Set `NEXT_PUBLIC_APP_URL` to `https://` plus that address, and redeploy.
- [ ] Update the Stripe webhook endpoint (step 5) to the custom domain if you set it up on the Vercel address first.

## 8. Deploy and create the first owner

- [ ] Deploy to Production. The build applies the database migrations; check the build log says they were applied.
- [ ] Open `https://<your domain>/admin/setup`, enter `SETUP_TOKEN`, and create the owner's account with their own email and a strong password. Setup refuses once any staff account exists.
- [ ] Remove `SETUP_TOKEN` from Vercel and redeploy. It's not needed again.
- [ ] Sign in as the owner. Invite the other staff from the Staff page; each gets an email to set their own password.

## 9. Branding

Signed in as the owner, on the Branding page:

- [ ] The gym's name, app name, tagline and initials.
- [ ] The logo, and an app icon (a square PNG, at least 512 pixels, for phones' home screens).
- [ ] The main and accent colours. The page checks they're readable and won't save colours that aren't.
- [ ] The text and heading fonts.
- [ ] The email sender name and footer.
- [ ] The business details on the terms, privacy policy and invoices.

Then check the public home page, the member sign-up and an email (such as a password reset) on a phone.

## 10. Locations, plans and staff

- [ ] On the Locations page, name the main location and give it its address. Add any other sites (D-125).
- [ ] On the Plans page, check the plans, prices and which locations each covers (D-126). Skip this if they come from an import.
- [ ] On the Staff page, give each staff member the right role and, for a chain, the locations they work at (D-128).
- [ ] On the Settings page, set the feature switches (such as keycard entry).

## 11. Import from the old system (if moving)

On the Import page, as the owner (D-130, D-131):

- [ ] **Plans**, then **members**, then **memberships**, one CSV file each. Download a template if you're building the files by hand.
- [ ] For each file, match the columns, run the check (a dry run that changes nothing), fix any problems in the file using the error report, and import. Each import is all or nothing and recorded in the audit log.
- [ ] Card details are never imported. Members are emailed a link to set their password, and add a card through Stripe when they sign in; they're first charged the day after the date they'd already paid up to.
- [ ] Tell members before the invitations go out, so they expect the email. The Import page shows who hasn't set a password and can send the links again.
- [ ] Turn off billing in the old system for everyone imported, so nobody is charged twice.

## 12. Check it

On your computer, with the copy's Production settings:

```bash
vercel env pull --environment=production .env.check   # needs the Vercel CLI, signed in to the gym's team
npx tsx --conditions=react-server --env-file=.env.check scripts/check-setup.ts
rm .env.check                                           # it contains the secrets
```

Or, with the settings already in your local `.env`: `npm run check:setup`. Add `-- --no-db` to skip the database checks.

`check:setup` reports **OK**, **NOTE**, **WARN** or **FAIL** for each part:

- the environment variables (present and the right shape, never their values);
- the gym's details in the config;
- the database, read-only: migrations applied, an owner, branding saved, plans to join, the main location's address, no demo accounts, and whether a Stripe webhook has arrived.

It exits with an error while anything fails. Fix each FAIL and look at each WARN, then run it again until it says Ready.

- [ ] `check:setup` says Ready (or only notes you've decided to accept).
- [ ] A test sign-up, payment (test card), class booking and check-in all work end to end, as in [STRIPE-TESTING.md](STRIPE-TESTING.md).
- [ ] The owner knows where the audit log and the finance exports are.
