import type Stripe from "stripe";
import { Prisma, type Status } from "@prisma/client";
import { prisma, type Db, type Tx } from "@/lib/db";
import { gym } from "@/lib/config";
import { gstFromInclusive } from "@/lib/money";
import { logAction } from "@/lib/audit";
import { markOrderRefunded } from "@/lib/shop/orders";
import { expireShopCheckout, recordShopPayment } from "@/lib/shop/checkout";
import { sendOrderEmail, type OrderEmailKind } from "@/lib/shop/emails";
import { getStripe, STRIPE_API_VERSION } from "./stripe";
import { refundGst, statusAfterRefunds } from "./refunds";

const SYSTEM = { kind: "system" as const, name: "Stripe" };

interface EventContext {
  tx: Tx;
  // When Stripe created the event. Stripe doesn't deliver events in order, so
  // subscription state from an event older than the last one applied is
  // ignored (R-08).
  eventAt: Date;
  // Emails to send once the transaction has committed, so a rolled-back event
  // never emails anyone and a retried one emails once.
  orderEmails: { orderId: string; kind: OrderEmailKind }[];
  // Refunds fetched from Stripe before the transaction (R-09).
  refunds: Pick<Stripe.Refund, "id" | "amount" | "status" | "reason">[] | null;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export function statusFromSubscription(sub: Pick<Stripe.Subscription, "status" | "pause_collection">): Status | null {
  if (sub.pause_collection) return "PAUSED";
  switch (sub.status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return null;
  }
}

async function handleCheckoutCompleted(ctx: EventContext, session: Stripe.Checkout.Session) {
  const { tx } = ctx;
  if (session.mode === "payment") {
    const result = await recordShopPayment(tx, session);
    if (result?.confirmed) ctx.orderEmails.push({ orderId: result.orderId, kind: "confirmed" });
    return;
  }
  if (session.mode !== "subscription") return;
  const memberId = session.metadata?.memberId ?? session.client_reference_id;
  if (!memberId) return;
  const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true, status: true, stripeSubscriptionId: true, membershipStartedAt: true } });
  if (!member) {
    console.warn("Stripe checkout completed for a member that no longer exists.");
    return;
  }
  const subscriptionId = idOf(session.subscription);
  // A second checkout (another tab) created a second subscription. Linking it
  // would orphan the first, which would keep charging with no way to cancel
  // it from GymOS, so staff are told instead (R-21).
  if (member.stripeSubscriptionId && member.stripeSubscriptionId !== subscriptionId && member.status !== "CANCELED") {
    await logAction(tx, SYSTEM, {
      action: "billing.duplicate_subscription",
      targetType: "Member",
      targetId: memberId,
      details: { existing: member.stripeSubscriptionId, duplicate: subscriptionId, note: "Cancel and refund the duplicate in Stripe." },
    });
    return;
  }
  const planId = session.metadata?.planId;
  const plan = planId ? await tx.membershipPlan.findUnique({ where: { id: planId }, select: { id: true } }) : null;
  const starting = member.status === "PENDING" || member.status === "CANCELED" || !member.membershipStartedAt;
  await tx.member.update({
    where: { id: memberId },
    data: {
      stripeCustomerId: idOf(session.customer),
      stripeSubscriptionId: subscriptionId,
      status: "ACTIVE",
      ...(starting ? { membershipStartedAt: ctx.eventAt, cancelAt: null, cancelledAt: null, cancelReason: null } : {}),
      ...(plan ? { planId: plan.id } : {}),
    },
  });
  await logAction(tx, SYSTEM, { action: "billing.subscription_started", targetType: "Member", targetId: memberId, details: { planId: plan?.id ?? null } });
}

async function handleSubscriptionChange(ctx: EventContext, sub: Stripe.Subscription, deleted: boolean) {
  const { tx, eventAt } = ctx;
  const member = await tx.member.findFirst({ where: { stripeSubscriptionId: sub.id }, select: { id: true, status: true, stripeEventAt: true, pastDueSince: true } });
  if (!member) return;
  if (member.stripeEventAt && member.stripeEventAt > eventAt) return;
  // A subscription Stripe has deleted can't become active again; only a new
  // checkout (a new subscription) restarts a cancelled membership.
  if (member.status === "CANCELED" && !deleted) return;

  const status = deleted ? "CANCELED" : statusFromSubscription(sub);
  const period =
    !deleted && sub.current_period_start && sub.current_period_end
      ? { currentPeriodStart: new Date(sub.current_period_start * 1000), currentPeriodEnd: new Date(sub.current_period_end * 1000) }
      : {};
  await tx.member.update({
    where: { id: member.id },
    data: {
      stripeEventAt: eventAt,
      ...period,
      ...(status ? { status } : {}),
      ...(status === "PAST_DUE" && !member.pastDueSince ? { pastDueSince: eventAt } : {}),
      ...(deleted && member.status !== "CANCELED" ? { cancelledAt: eventAt, cancelAt: null, pausedFrom: null, pausedUntil: null, pendingPlanId: null } : {}),
    },
  });
  if (status && status !== member.status) {
    await logAction(tx, SYSTEM, { action: "billing.subscription_status", targetType: "Subscription", targetId: sub.id, details: { status } });
  }
}

// Finds the member an invoice belongs to. A first payment can arrive before
// checkout.session.completed has linked the subscription, so the member ID
// that checkout put in the subscription's metadata is the fallback (R-01).
async function memberForInvoice(tx: Tx, invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.subscription);
  const customerId = idOf(invoice.customer);
  const select = { id: true, status: true, lastFailedInvoiceId: true, currentPeriodEnd: true, stripeEventAt: true, membershipStartedAt: true, membershipPlan: { select: { name: true } } } as const;
  const linked = await tx.member.findFirst({
    where: { OR: [...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []), ...(customerId ? [{ stripeCustomerId: customerId }] : [])] },
    select,
  });
  if (linked) return linked;
  const memberId = invoice.subscription_details?.metadata?.memberId;
  if (!memberId) return null;
  const member = await tx.member.findUnique({ where: { id: memberId }, select });
  if (!member) return null;
  await tx.member.update({ where: { id: memberId }, data: { stripeSubscriptionId: subscriptionId, stripeCustomerId: customerId } });
  return member;
}

async function handleInvoicePaid(ctx: EventContext, invoice: Stripe.Invoice) {
  const { tx, eventAt } = ctx;
  const member = await memberForInvoice(tx, invoice);
  if (!member || invoice.amount_paid <= 0) return;
  const line = invoice.lines?.data?.[0];
  // Stripe Tax isn't used; prices are GST-inclusive, so derive the GST.
  const gst = typeof invoice.tax === "number" && invoice.tax > 0 ? invoice.tax : gstFromInclusive(invoice.amount_paid, gym.business.gstRegistered);
  const paidAt = invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : eventAt;
  await tx.payment.upsert({
    where: { stripeInvoiceId: invoice.id },
    update: {},
    create: {
      memberId: member.id,
      amount: invoice.amount_paid,
      gstCents: gst,
      currency: invoice.currency,
      status: "succeeded",
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: idOf(invoice.payment_intent),
      description: line?.description ?? "Membership",
      planName: member.membershipPlan?.name ?? null,
      kind: "MEMBERSHIP",
      paidAt,
    },
  });

  // Paying an older invoice (a retry of last month's) mustn't move the
  // period backwards or clear debt from a newer failed invoice (R-20).
  const period = line?.period ? { start: new Date(line.period.start * 1000), end: new Date(line.period.end * 1000) } : null;
  const isOlderInvoice = Boolean(period && member.currentPeriodEnd && period.end < member.currentPeriodEnd);
  const periodIsNewer = period && !isOlderInvoice;
  // Stripe treats a subscription as paid up once its latest invoice is paid,
  // so any invoice settles the debt except one for an earlier period.
  const settlesDebt = !member.lastFailedInvoiceId || member.lastFailedInvoiceId === invoice.id || !isOlderInvoice;
  await tx.member.update({
    where: { id: member.id },
    data: {
      ...(settlesDebt ? { pastDueSince: null, amountOwingCents: 0, lastFailedInvoiceId: null, ...(member.status === "PAST_DUE" ? { status: "ACTIVE" as const } : {}) } : {}),
      ...(periodIsNewer && period ? { currentPeriodStart: period.start, currentPeriodEnd: period.end } : {}),
      ...(member.status === "PENDING" ? { status: "ACTIVE" as const, membershipStartedAt: member.membershipStartedAt ?? paidAt } : {}),
      ...(!member.stripeEventAt || member.stripeEventAt < eventAt ? { stripeEventAt: eventAt } : {}),
    },
  });
}

async function handleInvoiceFailed(ctx: EventContext, invoice: Stripe.Invoice) {
  const { tx, eventAt } = ctx;
  const subscriptionId = idOf(invoice.subscription);
  if (!subscriptionId) return;
  const member = await tx.member.findFirst({ where: { stripeSubscriptionId: subscriptionId, status: { not: "CANCELED" } }, select: { id: true, pastDueSince: true, stripeEventAt: true } });
  if (!member) return;
  await tx.member.update({
    where: { id: member.id },
    data: {
      status: "PAST_DUE",
      pastDueSince: member.pastDueSince ?? eventAt,
      amountOwingCents: invoice.amount_due,
      lastFailedInvoiceId: invoice.id,
      ...(!member.stripeEventAt || member.stripeEventAt < eventAt ? { stripeEventAt: eventAt } : {}),
    },
  });
  await logAction(tx, SYSTEM, { action: "billing.payment_failed", targetType: "Subscription", targetId: subscriptionId, details: { invoiceId: invoice.id, attempt: invoice.attempt_count } });
}

// Refunds made in the Stripe dashboard (or by GymOS) arrive here; each Stripe
// refund is recorded once. The charge in an event no longer carries its
// refunds (Stripe API 2022-11-15), so they're fetched before the
// transaction starts (R-09).
async function handleChargeRefunded(ctx: EventContext, charge: Stripe.Charge) {
  const { tx } = ctx;
  const intentId = idOf(charge.payment_intent);
  if (!intentId) return;
  const found = await tx.payment.findUnique({ where: { stripePaymentIntentId: intentId }, select: { id: true } });
  if (!found) return;
  // Same lock as refundPayment, so a refund made in GymOS and its webhook
  // can't both record it.
  await tx.$queryRaw`SELECT "id" FROM "Payout" WHERE "id" = ${found.id} FOR UPDATE`;
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: found.id } });
  let refunded = payment.refundedCents;
  for (const refund of ctx.refunds ?? charge.refunds?.data ?? []) {
    if (refund.status === "failed" || refund.status === "canceled") continue;
    const exists = await tx.refund.findUnique({ where: { stripeRefundId: refund.id } });
    if (exists) continue;
    await tx.refund.create({
      data: {
        paymentId: payment.id,
        amountCents: refund.amount,
        gstCents: refundGst(payment, refunded, refund.amount),
        reason: refund.reason ?? "Refunded in Stripe",
        stripeRefundId: refund.id,
        method: "STRIPE",
        staffName: "Stripe",
      },
    });
    refunded += refund.amount;
  }
  if (refunded === payment.refundedCents) return;
  await tx.payment.update({ where: { id: payment.id }, data: { refundedCents: refunded, status: statusAfterRefunds(payment.amount, refunded, payment.status) } });
  if (refunded >= payment.amount && payment.orderId && (await markOrderRefunded(tx, payment.orderId, "Refunded in Stripe", "Stripe"))) {
    ctx.orderEmails.push({ orderId: payment.orderId, kind: "refunded" });
  }
}

const HANDLED = new Set([
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "charge.refunded",
]);

async function prefetchRefunds(event: Stripe.Event): Promise<EventContext["refunds"]> {
  if (event.type !== "charge.refunded") return null;
  const charge = event.data.object;
  if (charge.refunds?.data) return null;
  const intentId = idOf(charge.payment_intent);
  if (!intentId) return null;
  const list = await getStripe().refunds.list({ payment_intent: intentId, limit: 100 });
  return list.data;
}

// A unique-constraint clash is a duplicate only if another delivery of the
// same event has committed; our own transaction rolled back, so if the event
// row exists now, someone else recorded it.
async function isDuplicateEvent(db: Db, eventId: string, error: unknown): Promise<boolean> {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  return Boolean(await db.stripeEvent.findUnique({ where: { id: eventId }, select: { id: true } }));
}

// Processes one verified event exactly once. The event ID is recorded in the
// same transaction as its effects: a retry after success is a no-op, and a
// failure rolls back both so Stripe's retry runs it again. Only a clash on
// the event ID means "already processed"; any other conflict is an error, so
// Stripe retries and the failure is visible (R-19).
export async function processStripeEvent(event: Stripe.Event, db: Db = prisma): Promise<"processed" | "duplicate" | "ignored"> {
  if (event.api_version && event.api_version !== STRIPE_API_VERSION) {
    console.warn(`Stripe event ${event.type} uses API version ${event.api_version}; GymOS expects ${STRIPE_API_VERSION}. Set the webhook endpoint's version to match.`);
  }
  const already = await db.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } });
  if (already) return "duplicate";
  const refunds = await prefetchRefunds(event);
  const orderEmails: EventContext["orderEmails"] = [];
  try {
    await db.$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
      const ctx: EventContext = { tx, eventAt: event.created ? new Date(event.created * 1000) : new Date(), orderEmails, refunds };
      switch (event.type) {
        case "checkout.session.completed":
          return handleCheckoutCompleted(ctx, event.data.object);
        case "checkout.session.expired":
          return expireShopCheckout(tx, event.data.object);
        case "customer.subscription.updated":
          return handleSubscriptionChange(ctx, event.data.object, false);
        case "customer.subscription.deleted":
          return handleSubscriptionChange(ctx, event.data.object, true);
        case "invoice.paid":
        case "invoice.payment_succeeded":
          return handleInvoicePaid(ctx, event.data.object);
        case "invoice.payment_failed":
          return handleInvoiceFailed(ctx, event.data.object);
        case "charge.refunded":
          return handleChargeRefunded(ctx, event.data.object);
      }
    });
  } catch (error) {
    if (await isDuplicateEvent(db, event.id, error)) return "duplicate";
    throw error;
  }
  for (const email of orderEmails) {
    // An email failure must not make Stripe retry an event that has already
    // been recorded.
    await sendOrderEmail(db, email.orderId, email.kind).catch((error) => console.error("Order email failed:", error instanceof Error ? error.name : "unknown"));
  }
  return HANDLED.has(event.type) ? "processed" : "ignored";
}
