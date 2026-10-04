# Testing payments with Stripe test mode

A step-by-step plan for checking every payment flow on the live site with Stripe in **test mode**. No real money moves: test-mode keys only accept Stripe's test cards. Work through it in order; later steps use the members and payments from earlier ones.

Each step says what to do, what you should see in GymOS, and what you should see in the Stripe dashboard (with **Test mode** switched on, top right). Tick the boxes as you go. If something doesn't match, note the step number and what you saw instead.

## 1. Set up (once)

1. **Get the test keys.** In the Stripe dashboard, switch on Test mode and open Developers → API keys. Copy the **secret key**; it starts with `sk_test_`. Never use a key that starts with `sk_live_`.
2. **Create the webhook endpoint.** Go to Developers → Webhooks → Add endpoint.
   - **URL:** your site's address followed by `/api/webhooks/stripe`, for example `https://your-gym.vercel.app/api/webhooks/stripe`.
   - **API version:** `2023-10-16`. If the form doesn't offer a version, the account default is used; `npm run stripe:check -- --remote` tells you if that's wrong.
   - **Events:** select every event in the list below.
   - After saving, reveal the **Signing secret**; it starts with `whsec_`.

   | Event | Why GymOS needs it |
   | --- | --- |
   | `checkout.session.completed` | A member finished paying for a membership or a shop order |
   | `checkout.session.expired` | A shop checkout was abandoned, so its reserved stock is released |
   | `customer.subscription.updated` | A membership's status changed (active, past due, cancelling) |
   | `customer.subscription.deleted` | A membership was cancelled |
   | `invoice.paid` | A membership payment went through |
   | `invoice.payment_succeeded` | The same, under its older name (optional if `invoice.paid` is selected) |
   | `invoice.payment_failed` | A membership payment failed, so the member becomes past due |
   | `charge.refunded` | A refund was made, in GymOS or in the Stripe dashboard |
   | `charge.refund.updated` | A refund failed or was cancelled after it was made |
   | `refund.updated` | The same, under its newer name (one of these two is enough) |

3. **Turn on the customer portal.** Go to Settings → Billing → Customer portal and allow customers to update payment methods. GymOS's "Update card" button opens this portal.
4. **Add the keys to Vercel.** In Project → Settings → Environment Variables, for **Production**:
   - `STRIPE_SECRET_KEY` = the `sk_test_` key;
   - `STRIPE_WEBHOOK_SECRET` = the `whsec_` secret;
   - leave `STRIPE_ALLOW_LIVE_KEYS` unset.

   Then redeploy production, since environment changes only apply to new deployments.
5. **Check the setup** from your own computer, with the same two values in your shell (not in a file you commit):

   ```sh
   STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... npm run stripe:check -- --remote --url https://your-gym.vercel.app
   ```

   Every line should say `OK` or `NOTE`, ending with "Ready for Stripe test mode". The check never prints your keys. `--remote` asks Stripe, read-only, whether the endpoint exists, is enabled, sends every event and uses the right API version.
6. **Have email working, or use members added at the desk.** If PR B (email confirmation) is merged, a member who joins online must confirm their email before paying online. On production that needs `RESEND_API_KEY` set. Without email, add the test member at the front desk instead (Members → Add member); staff-added members count as confirmed. Then use "Forgot your password?" on the member sign-in page to give them a password. That also needs email, so with no email at all, join online on a preview deployment, where links show on screen.

**Test cards.** For any card, use any future expiry date, any three-digit CVC and any postcode.

| Card number | What it does |
| --- | --- |
| 4242 4242 4242 4242 | Always succeeds |
| 4000 0025 0000 3155 | Asks for 3D Secure authentication, then succeeds |
| 4000 0000 0000 9995 | Declined (insufficient funds) at checkout |
| 4000 0000 0000 0341 | Saves fine, but every later charge fails (for failed renewals) |

**Where to look in GymOS.**
- **Staff:** Payments (`/admin/billing`), a payment's page, the member's page (Membership panel and History), Finance (`/admin/finance`) and the Audit log (`/admin/audit`).
- **Members:** My membership (`/member/membership`).

Staff steps need an Owner, Admin or Manager account; refunds need "Issue refunds".

## 2. Joining

- [ ] **2.1 Join with a card.** Sign in as a member with no plan, or create one (section 1, step 6).
  - **Do:** choose **Standard**, tick the terms, press **Pay by card**, and pay with 4242 4242 4242 4242.
  - **GymOS:** you return to the member home with the membership **Active** on Standard. My membership shows the plan, the next billing date and an invoice (INV-…). Staff Payments has a new payment for $29.95 including GST. The member's History shows "Joined".
  - **Stripe:** Customers has a new customer with that email. Subscriptions shows an Active $29.95/week subscription. Payments shows a $29.95 charge that **Succeeded**. Webhooks → your endpoint shows `checkout.session.completed` and `invoice.paid`, each answered **200**.
- [ ] **2.2 3D Secure.** Repeat with another member and card 4000 0025 0000 3155, and approve the test authentication pop-up. Same results as 2.1.
- [ ] **2.3 Declined card.** Repeat with 4000 0000 0000 9995.
  - **Stripe Checkout:** says the card was declined, and you can try another card.
  - **GymOS:** the member stays **Not started** with no payment.
  - **Stripe:** a failed payment attempt; no active subscription.
- [ ] **2.4 Abandon checkout.** Start checkout and close the tab without paying.
  - **GymOS:** nothing changes. The member can start again.

## 3. Changing plans

Uses the Standard member from 2.1.

- [ ] **3.1 Upgrade.** As the member, open My membership → Change plan → **Unlimited**, and confirm.
  - **GymOS:** the plan shows **Unlimited** straight away; class credits and the guest pass apply now. History shows "Plan changed".
  - **Stripe:** the subscription's price is now $39.95/week. Upcoming invoice shows a proration line for the rest of this week; the difference is charged with the next renewal, not straight away. `customer.subscription.updated` answered **200**.
- [ ] **3.2 Downgrade.** Change plan → **Off-peak**.
  - **GymOS:** the plan stays Unlimited, with Off-peak tagged **Starts next billing date**. History shows "Plan change scheduled".
  - **Stripe:** the subscription now has the $19.95/week price from the next renewal, with no proration line.
  - **At the next renewal:** the daily job switches GymOS to Off-peak. Plans are weekly, so this happens within 7 days. Check back then; the member should be on Off-peak, with a new $19.95 payment.

## 4. Pausing and resuming

- [ ] **4.1 Pause.** As the member, My membership → **Pause my membership**. Choose dates at least 7 days apart (up to 90), starting today, and confirm.
  - **GymOS:** status **Paused** with the dates; the member can't book classes or check in while paused. History shows "Pause scheduled".
  - **Stripe:** the subscription shows payment collection **paused** until the end date, so invoices in that time are voided, not charged.
- [ ] **4.2 Resume early.** Press **Resume now**.
  - **GymOS:** **Active** again.
  - **Stripe:** collection resumed.
- [ ] **4.3 Staff can do the same.** From the member's page, the Membership panel, pause and resume. Same results.
- [ ] **4.4 Limits.** Try a pause shorter than 7 days, or a third pause within 12 months.
  - **GymOS:** refuses with a clear reason; nothing changes in Stripe.

## 5. Cancelling

The gym's rules: a 7-day cooling-off period from when the membership started (cancelling ends it straight away), and 14 days' notice after that.

- [ ] **5.1 Cancel in cooling-off.** With a member who joined within the last 7 days, My membership → **Cancel my membership**, and confirm.
  - **GymOS:** status **Cancelled** straight away. History shows "Cancelled". Future class bookings are released.
  - **Stripe:** the subscription is **Canceled**; `customer.subscription.deleted` answered **200**. Cooling-off doesn't refund anything automatically: if the gym's terms promise money back, refund it in step 7.
- [ ] **5.2 Cancel with notice.** Needs a membership that started more than 7 days ago. On test data, ask a staff member to cancel from the member's page, which follows the same rules, or come back to this step a week after 2.2.
  - **GymOS:** a cancellation date 14 days away; the membership stays Active until then.
  - **Stripe:** the subscription shows **Cancels on** that date.
- [ ] **5.3 Withdraw.** Press **Cancel** → withdraw (member) or **Withdraw cancellation** (staff).
  - **GymOS:** no cancellation date.
  - **Stripe:** "Cancels on" is gone.
- [ ] **5.4 Staff "End it today instead".** In the member's Membership panel, cancel and tick **End it today instead**. Staff can end a membership immediately whatever the rules.
  - **GymOS:** Cancelled now.
  - **Stripe:** subscription Canceled.

## 6. Shop order

- [ ] **6.1 Buy.** As a member (confirmed email if PR B is merged), add a product to the cart, choose **Pick up**, press **Pay**, and pay with 4242 4242 4242 4242.
  - **GymOS:** the member sees the order as **Paid** with a tax invoice. The member's plan discount is applied. Staff Orders shows it; stock for that product has gone down by the quantity bought.
  - **Stripe:** a one-off payment that **Succeeded**; `checkout.session.completed` answered **200**.
- [ ] **6.2 Fulfil.** As staff, open the order: **Mark packed**, then **Ready for pickup**, then hand it over.
  - **GymOS:** each step appears in the order's progress. The member is emailed at "Ready for pickup", if email is set up.
- [ ] **6.3 Abandoned checkout.** Start a shop checkout and don't pay. Stripe expires unpaid checkouts after about 24 hours.
  - **GymOS:** after expiry, the order shows **Cancelled** and its stock is back.
  - **Stripe:** the checkout session is **Expired**; `checkout.session.expired` answered **200**.

## 7. Refunds

Use the shop payment from 6.1 and a membership payment from 2.1. Staff → Payments → open the payment → **Refund**.

- [ ] **7.1 Partial refund to card.** Refund part of the amount (say $10.00) with a reason, choosing **Refund to their card through Stripe**.
  - **GymOS:** the payment shows **Part refunded**, with the refund listed (amount, reason, who, and the GST share). Finance for this month shows the refund and the reduced GST. The Audit log shows "billing: refunded" with the old and new refunded amounts.
  - **Stripe:** the payment shows a $10.00 refund; `charge.refunded` answered **200**.
- [ ] **7.2 Full refund.** Refund the rest.
  - **GymOS:** **Refunded**. For a shop order, the order is marked **Refunded** and its stock returns.
  - **Stripe:** fully refunded.
- [ ] **7.3 Can't over-refund.** Try to refund more than what's left.
  - **GymOS:** refuses, saying the most that can be refunded; nothing reaches Stripe.
- [ ] **7.4 Refund made in Stripe.** In the Stripe dashboard, refund part of another payment.
  - **GymOS:** within a minute the payment shows the refund, recorded as by "Stripe", and the Audit log has the entry.
- [ ] **7.5 Manual refund.** Choose **I paid it back another way (cash, bank transfer)**.
  - **GymOS:** recorded, and Finance includes it.
  - **Stripe:** nothing happens, which is correct.
- [ ] **7.6 A refund that fails later (R-25).** Card refunds in test mode don't fail, so this can only be checked roughly. If you have a payment made with a card that later fails refunds, refund it, then watch for `charge.refund.updated` with status `failed`.
  - **GymOS:** the refund is marked **Failed: not returned to the customer**. The payment's refunded total goes back down. Finance stops counting it. The Audit log has "billing: refund failed" saying what to follow up.

  The behaviour is covered by automated tests with Stripe's real event shapes (`tests/integration/refund-failures.test.ts`). See D-116.

## 8. A failed payment and recovery

Uses an Active member who joined by card (2.1).

- [ ] **8.1 Make the next charge fail.** As the member, My membership → **Update card**, and in Stripe's portal replace the card with 4000 0000 0000 0341.
- [ ] **8.2 Let it renew.** Either wait for the weekly renewal, or bring it forward: in Stripe, open the subscription → Actions → Update subscription, and reset the billing cycle so it bills now. The wording varies; if that option isn't there, wait for the renewal.
  - **GymOS:** status **Past due**, with the amount owing. Staff Payments → **Overdue payments** lists the member. For 7 days the member can still check in (a warning shows at the front desk); after that, check-in refuses with "Payment overdue". Reminder emails go out on days 1, 3 and 7, if email is set up.
  - **Stripe:** the invoice is **Past due / Open** with a failed payment attempt; `invoice.payment_failed` answered **200**. Stripe retries on its own schedule (Settings → Billing → Subscriptions and emails → Smart Retries).
- [ ] **8.3 Recover.** As the member, **Update card** back to 4242 4242 4242 4242. Then either wait for Stripe's retry, or as staff press **Retry** in Overdue payments (or **Retry payment** on the member's page).
  - **GymOS:** status **Active** again, the amount owing is cleared, the member drops off Overdue payments, and a new payment appears.
  - **Stripe:** the invoice is **Paid**; `invoice.paid` answered **200**.

## 9. Webhook health

- [ ] **9.1** Stripe → Developers → Webhooks → your endpoint: every delivery from these tests answered **200**. A **400** means the signing secret doesn't match `STRIPE_WEBHOOK_SECRET`. A **500** means GymOS hit an error; note the event type and time.
- [ ] **9.2** Resend one already-delivered event from that page.
  - **GymOS:** answers 200 and changes nothing (events are processed once).

## When you're done

Leave the test keys in place for as long as you're testing. Before taking real money, the owner needs to:
- read `docs/COMPLIANCE-NOTES.md`;
- switch to live keys and set `STRIPE_ALLOW_LIVE_KEYS=true` deliberately;
- create a live-mode webhook endpoint with the same events.

None of that is part of this plan.
