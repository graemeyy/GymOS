// The Stripe webhook events GymOS acts on. The webhook endpoint in the Stripe
// dashboard must send all of these (`npm run stripe:check` lists them), with
// its API version set to the one in lib/billing/stripe.ts.
export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "charge.refunded",
  // A refund that fails or is cancelled after it was made (R-25). Stripe
  // sends both names for the same change; either one is enough.
  "charge.refund.updated",
  "refund.updated",
] as const;

export type StripeWebhookEvent = (typeof STRIPE_WEBHOOK_EVENTS)[number];

// What each one does, for the setup check and docs/STRIPE-TESTING.md.
export const STRIPE_EVENT_PURPOSE: Record<StripeWebhookEvent, string> = {
  "checkout.session.completed": "a member finished paying for a membership or a shop order",
  "checkout.session.expired": "a shop checkout was abandoned, so its reserved stock is released",
  "customer.subscription.updated": "a membership's status changed (active, past due, cancelling)",
  "customer.subscription.deleted": "a membership was cancelled",
  "invoice.paid": "a membership payment went through",
  "invoice.payment_succeeded": "a membership payment went through (older event name)",
  "invoice.payment_failed": "a membership payment failed, so the member becomes past due",
  "charge.refunded": "a refund was made, in GymOS or the Stripe dashboard",
  "charge.refund.updated": "a refund failed or was cancelled after it was made",
  "refund.updated": "a refund failed or was cancelled after it was made (newer event name)",
};
