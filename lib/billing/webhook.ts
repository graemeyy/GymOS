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
  if (!status) return;
  const result = await tx.member.updateMany({ where: { stripeSubscriptionId: sub.id }, data: { status } });
  if (result.count > 0) {
    await logAction(tx, SYSTEM, { action: "billing.subscription_status", targetType: "Subscription", targetId: sub.id, details: { status } });
  }
}

async function handleInvoicePaid(tx: Tx, invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.subscription);
  const customerId = idOf(invoice.customer);
  const member = await tx.member.findFirst({
    where: { OR: [...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []), ...(customerId ? [{ stripeCustomerId: customerId }] : [])] },
    select: { id: true, status: true },
  });
  if (!member || invoice.amount_paid <= 0) return;
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
      description: invoice.lines?.data?.[0]?.description ?? "Membership",
    },
  });
  if (member.status === "PAST_DUE") {
    await tx.member.update({ where: { id: member.id }, data: { status: "ACTIVE" } });
  }
}

async function handleInvoiceFailed(tx: Tx, invoice: Stripe.Invoice) {
  const subscriptionId = idOf(invoice.subscription);
  if (!subscriptionId) return;
  const result = await tx.member.updateMany({ where: { stripeSubscriptionId: subscriptionId, status: { not: "CANCELED" } }, data: { status: "PAST_DUE" } });
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
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
  return handled.has(event.type) ? "processed" : "ignored";
}
