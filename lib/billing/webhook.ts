import type Stripe from "stripe";
import { Prisma, type Status } from "@prisma/client";
import type { Db, Tx } from "@/lib/db";
import { gym } from "@/lib/config";
import { gstFromInclusive } from "@/lib/money";
import { logAction } from "@/lib/audit";

const SYSTEM = { kind: "system" as const, name: "Stripe" };

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

async function handleCheckoutCompleted(tx: Tx, session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;
  const memberId = session.metadata?.memberId ?? session.client_reference_id;
  if (!memberId) return;
  const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) {
    console.warn(`Stripe checkout completed for unknown member ${memberId}`);
    return;
  }
  const planId = session.metadata?.planId;
  const plan = planId ? await tx.membershipPlan.findUnique({ where: { id: planId }, select: { id: true } }) : null;
  await tx.member.update({
    where: { id: memberId },
    data: {
      stripeCustomerId: idOf(session.customer),
      stripeSubscriptionId: idOf(session.subscription),
      status: "ACTIVE",
      ...(plan ? { planId: plan.id } : {}),
    },
  });
  await logAction(tx, SYSTEM, { action: "billing.subscription_started", targetType: "Member", targetId: memberId, details: { planId: plan?.id ?? null } });
}

async function handleSubscriptionChange(tx: Tx, sub: Stripe.Subscription, deleted: boolean) {
  const status = deleted ? "CANCELED" : statusFromSubscription(sub);
  const period =
    !deleted && sub.current_period_start && sub.current_period_end
      ? { currentPeriodStart: new Date(sub.current_period_start * 1000), currentPeriodEnd: new Date(sub.current_period_end * 1000) }
      : {};
  if (!status) {
    if (Object.keys(period).length) await tx.member.updateMany({ where: { stripeSubscriptionId: sub.id }, data: period });
    return;
  }
  const result = await tx.member.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { status, ...period, ...(deleted ? { cancelledAt: new Date(), cancelAt: null } : {}) },
  });
  if (result.count > 0) {
    await logAction(tx, SYSTEM, { action: "billing.subscription_status", targetType: "Subscription", targetId: sub.id, details: { status } });
  }
}

async function handleInvoicePaid(tx: Tx, invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.subscription);
  const customerId = idOf(invoice.customer);
  const member = await tx.member.findFirst({
    where: { OR: [...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []), ...(customerId ? [{ stripeCustomerId: customerId }] : [])] },
    select: { id: true, status: true, membershipPlan: { select: { name: true } } },
  });
  if (!member || invoice.amount_paid <= 0) return;
  const line = invoice.lines?.data?.[0];
  // Stripe Tax isn't used; prices are GST-inclusive, so derive the GST.
  const gst = typeof invoice.tax === "number" && invoice.tax > 0 ? invoice.tax : gstFromInclusive(invoice.amount_paid, gym.business.gstRegistered);
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
    },
  });
  await tx.member.update({
    where: { id: member.id },
    data: {
      ...(member.status === "PAST_DUE" ? { status: "ACTIVE" } : {}),
      pastDueSince: null,
      amountOwingCents: 0,
      lastFailedInvoiceId: null,
      ...(line?.period ? { currentPeriodStart: new Date(line.period.start * 1000), currentPeriodEnd: new Date(line.period.end * 1000) } : {}),
    },
  });
}

// Refunds made in the Stripe dashboard (or by GymOS) arrive here; each Stripe
// refund is recorded once.
async function handleChargeRefunded(tx: Tx, charge: Stripe.Charge) {
  const intentId = idOf(charge.payment_intent);
  if (!intentId) return;
  const payment = await tx.payment.findUnique({ where: { stripePaymentIntentId: intentId } });
  if (!payment) return;
  for (const refund of charge.refunds?.data ?? []) {
    if (refund.status === "failed" || refund.status === "canceled") continue;
    const exists = await tx.refund.findUnique({ where: { stripeRefundId: refund.id } });
    if (exists) continue;
    const gst = payment.amount > 0 ? Math.round((payment.gstCents * refund.amount) / payment.amount) : 0;
    await tx.refund.create({
      data: { paymentId: payment.id, amountCents: refund.amount, gstCents: gst, reason: refund.reason ?? "Refunded in Stripe", stripeRefundId: refund.id, method: "STRIPE", staffName: "Stripe" },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { refundedCents: { increment: refund.amount } } });
  }
  const after = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
  await tx.payment.update({ where: { id: payment.id }, data: { status: after.refundedCents >= after.amount ? "refunded" : after.refundedCents > 0 ? "partially_refunded" : after.status } });
}

async function handleInvoiceFailed(tx: Tx, invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.subscription);
  if (!subscriptionId) return;
  const member = await tx.member.findFirst({ where: { stripeSubscriptionId: subscriptionId, status: { not: "CANCELED" } }, select: { id: true, pastDueSince: true } });
  const result = member
    ? await tx.member.updateMany({
        where: { id: member.id },
        data: { status: "PAST_DUE", pastDueSince: member.pastDueSince ?? new Date(), amountOwingCents: invoice.amount_due, lastFailedInvoiceId: invoice.id },
      })
    : { count: 0 };
  if (result.count > 0) {
    await logAction(tx, SYSTEM, { action: "billing.payment_failed", targetType: "Subscription", targetId: subscriptionId, details: { invoiceId: invoice.id, attempt: invoice.attempt_count } });
  }
}

// Processes one verified event exactly once. The event ID is recorded in the
// same transaction as its effects: a retry after success is a no-op, and a
// failure rolls back both so Stripe's retry runs it again.
export async function processStripeEvent(db: Db, event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  const handled = new Set([
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "charge.refunded",
  ]);
  try {
    await db.$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
      switch (event.type) {
        case "checkout.session.completed":
          return handleCheckoutCompleted(tx, event.data.object);
        case "customer.subscription.updated":
          return handleSubscriptionChange(tx, event.data.object, false);
        case "customer.subscription.deleted":
          return handleSubscriptionChange(tx, event.data.object, true);
        case "invoice.paid":
        case "invoice.payment_succeeded":
          return handleInvoicePaid(tx, event.data.object);
        case "invoice.payment_failed":
          return handleInvoiceFailed(tx, event.data.object);
        case "charge.refunded":
          return handleChargeRefunded(tx, event.data.object);
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
  return handled.has(event.type) ? "processed" : "ignored";
}
