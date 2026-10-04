# Compliance notes

GymOS builds the hooks for Australian obligations. It doesn't make the gym compliant on its own, and nothing here is legal or tax advice. Every assumption below needs checking by the gym's lawyer and accountant before real members are signed up.

Status key: **Built** means the app enforces or supports it. **Hook** means there's a place for it, but the gym must supply content or a decision. **Owner** means it's entirely the gym's responsibility.

## GST and tax invoices

| # | Assumption | Status |
| --- | --- | --- |
| C-01 | Prices shown to members include GST (ACCC component-pricing guidance: show the total price). | Built (PR 1): public plan prices say "Prices include GST." |
| C-02 | GST in an inclusive price is 1/11, rounded to the nearest cent, worked out per transaction. | Built (PR 1): `lib/money.ts`, unit-tested. |
| C-03 | The gym is registered for GST. If not, set `business.gstRegistered: false` and GST becomes 0; invoices must then not be called tax invoices. | Hook |
| C-04 | A tax invoice for a sale under $1,000 needs: the words "tax invoice", the seller's identity and ABN, date, description, GST amount (or that the total includes GST), and the total. Sales of $1,000 or more also need the buyer's identity or ABN. | Built (PR 2): printable invoice per payment with ABN, GST, sequential number and the buyer's name; a "Receipt" with no GST if the gym isn't registered. |
| C-05 | Financial records are kept at least five years (ATO). Config default is seven; the schema refuses fewer than five. Archiving a member keeps their payments. | Built (PR 1) |
| C-06 | Finance exports are labelled as summaries, not tax advice, and should be checked by an accountant before lodging a BAS. | Built (PR 1 and 2): finance page and exports show GST collected net of refunds by month, BAS quarter and financial year, labelled as a summary for an accountant to check. |

## Australian Consumer Law: memberships, cancellation, refunds

| # | Assumption | Status |
| --- | --- | --- |
| C-07 | Cancellation and refund rules are the owner's, set in `policies.cancellation` and `policies.shop` in config, not hard-coded. | Built (PR 1 config; PR 2 enforces cancellation, pause and plan-change rules for staff; PR 3 for members). |
| C-08 | Consumer guarantees can't be excluded. Terms must not say "no refunds"; a member is entitled to a remedy if a service isn't provided with due care or isn't fit for purpose, whatever the gym's change-of-mind policy says. | Built (PR 3): the template terms state consumer guarantees can't be excluded; shop pages and order emails say faulty items are always covered. Owner to have reviewed. |
| C-09 | Some states regulate fitness memberships directly, for example NSW's Fitness Services (Pre-paid Fees) legislation, which includes a cooling-off period and limits on pre-payment. Config has `coolingOffDays` (default 7) and `minimumTermWeeks`. The right values depend on the state and the contract. | Hook. Owner must confirm with a lawyer. |
| C-10 | Unfair contract terms law applies to standard-form consumer contracts, including gym memberships (with penalties since November 2023). Membership terms need legal review. | Owner |
| C-11 | Price rises for existing members need notice. The app applies a new plan price to new sign-ups only; existing Stripe subscriptions keep their price until changed. The settings screen tells the owner to give written notice. | Built (PR 1); notice emails are the owner's. |
| C-12 | Members accept the current terms version before paying. Checkout requires `acceptTerms: true` and records the terms version in Stripe metadata and the audit log. | Built (PR 3): sign-up and checkout record a timestamped acceptance per document and version (`LegalAcceptance`); members are asked again when a version changes. |
| C-13 | Direct debit, if used instead of cards, has its own rules (BECS). Phase 1 uses card payments through Stripe. | Owner |

## Privacy Act 1988 and the Australian Privacy Principles

Small businesses under $3 million turnover are often exempt from the Privacy Act, but a gym that holds health information (for example, injuries recorded in notes) can be covered regardless. GymOS assumes the APPs apply.

| # | Assumption | Status |
| --- | --- | --- |
| C-14 | Collect only what's needed (APP 3). Members: name, email, plan, payment status, visits and bookings. No date of birth, address, gender or photo is collected. Card details stay with Stripe and never touch GymOS. | Built (PR 1) |
| C-15 | Staff notes about members can contain sensitive or health information. Notes are hidden in the member app but included in a member's data download (APP 12), and the field says so. Staff should be trained not to record health details unless needed and consented to. | Hook / Owner |
| C-16 | Logs don't contain personal data. Prisma query logging (which wrote member emails to hosting logs) is off. Errors log a message, not request bodies. | Built (PR 1) |
| C-17 | Retention periods are in config (`policies.dataRetention`) and will be explained on the privacy policy page. | Built (PR 3): the privacy policy shows the periods from config, and the daily job deletes old check-ins and anonymises long-archived members. |
| C-18 | Members can export their data and ask for their account to be deleted (APP 12 and 13). Deletion keeps financial records the law requires and removes or anonymises the rest. | Built (PR 3): data export (JSON, includes staff notes) and account deletion in the member app. Deletion anonymises and keeps financial records. |
| C-19 | A template Privacy Policy and Terms will ship, clearly marked as needing a lawyer's review. `legal.reviewedByLawyer` in config is `false` until that's done. | Built (PR 3): `/terms` and `/privacy` generated from config, with a "Template only" warning until `legal.reviewedByLawyer` is true. Owner must have them reviewed. |
| C-20 | Data breaches likely to cause serious harm must be notified under the Notifiable Data Breaches scheme, if the gym is covered. | Owner |
| C-21 | Hosting may be outside Australia (APP 8, cross-border disclosure). The privacy policy must say where data is stored. | Owner: the privacy policy has a placeholder to list hosting providers and countries. |

## Supplements (shop)

| # | Assumption | Status |
| --- | --- | --- |
| C-22 | GymOS never writes health, performance or therapeutic claims. Product descriptions are entered by the owner. | Built (PR 2): descriptions are owner-entered; the editor warns on claim-like words. |
| C-23 | Some supplements are regulated by the TGA (for example, as listed medicines or sports supplements with therapeutic claims), and food-type supplements fall under the Food Standards Code. Selling them and describing them can be regulated. The owner needs their own advice. The shop admin will show a guideline note. | Built (PR 2: guideline note on supplement products); Owner (advice) |
| C-24 | Advertising claims must not be misleading (ACL). | Owner |

## Other

| # | Assumption | Status |
| --- | --- | --- |
| C-25 | Accessibility: the main flows have zero axe violations (WCAG 2.1 A and AA rules) at 375px and 1440px. This isn't a full WCAG audit. | Built (PR 1, tested in CI) |
| C-26 | Spam Act 2003: marketing emails need consent and an unsubscribe. Transactional emails (receipts, booking confirmations) don't. Announcements in PR 2 respect notification preferences. | Built (PR 2 and 3): announcement emails go only to members with "Gym news" on, and include a link to switch it off. Recommended follow-up: a one-click unsubscribe link that doesn't need signing in. |
| C-27 | Staff passwords and member passwords are hashed with scrypt; no one, including the owner, can read them. | Built |
