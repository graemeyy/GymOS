import type { Db } from "@/lib/db";
import { gym } from "@/lib/config";
import { ApiError } from "@/lib/http/errors";
import { getStripe } from "./stripe";
import { logAction, type Actor } from "@/lib/audit";
import { markOrderRefunded } from "@/lib/shop/orders";
import { sendOrderEmail } from "@/lib/shop/emails";

export interface RefundInput {
  paymentId: string;
  amountCents: number;
  reason: string;
  // STRIPE refunds the card. MANUAL records money returned another way.
  method: "STRIPE" | "MANUAL";
}

// GST on a partial refund is the same share of the payment's GST.
export function refundGst(paymentAmount: number, paymentGst: number, refundAmount: number): number {
  if (paymentAmount <= 0) return 0;
  if (refundAmount === paymentAmount) return paymentGst;
  return Math.round((paymentGst * refundAmount) / paymentAmount);
}

export async function refundPayment(db: Db, actor: Actor & { kind: "staff" }, input: RefundInput) {
  const payment = await db.payment.findUnique({ where: { id: input.paymentId }, include: { order: true } });
  if (!payment) throw new ApiError("not_found", "Payment not found.");
  const refundable = payment.amount - payment.refundedCents;
  if (input.amountCents <= 0) throw new ApiError("validation_failed", "Enter an amount above zero.", { amountCents: "Above zero" });
  if (input.amountCents > refundable) {
    throw new ApiError("validation_failed", `At most ${(refundable / 100).toFixed(2)} can be refunded on this payment.`, { amountCents: "Too much" });
  }

  let stripeRefundId: string | null = null;
  if (input.method === "STRIPE") {
    if (!payment.stripePaymentIntentId) {
      throw new ApiError("conflict", "This payment didn't go through Stripe. Record a manual refund instead.");
    }
    try {
      const refund = await getStripe().refunds.create(
        { payment_intent: payment.stripePaymentIntentId, amount: input.amountCents, metadata: { paymentId: payment.id } },
        // Same request, same refund: a double-click can't refund twice.
        { idempotencyKey: `refund-${payment.id}-${payment.refundedCents}-${input.amountCents}` }
      );
      stripeRefundId = refund.id;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("upstream_failed", "Stripe couldn't process the refund. Nothing was recorded. Try again shortly.");
    }
  }

  const gst = gym.business.gstRegistered ? refundGst(payment.amount, payment.gstCents, input.amountCents) : 0;
  let orderRefunded = false;
  const refund = await db.$transaction(async (tx) => {
    // Guarded update: two refunds racing can't take the total past the payment.
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, refundedCents: { lte: payment.amount - input.amountCents } },
      data: {
        refundedCents: { increment: input.amountCents },
        status: payment.refundedCents + input.amountCents >= payment.amount ? "refunded" : "partially_refunded",
      },
    });
    if (updated.count === 0) throw new ApiError("conflict", "Another refund changed this payment. Reload and try again.");
    const refund = await tx.refund.create({
      data: { paymentId: payment.id, amountCents: input.amountCents, gstCents: gst, reason: input.reason, stripeRefundId, method: input.method, staffId: actor.id, staffName: actor.name },
    });
    if (payment.order && payment.refundedCents + input.amountCents >= payment.amount) {
      orderRefunded = await markOrderRefunded(tx, payment.order.id, input.reason, actor.name);
    }
    await logAction(tx, actor, {
      action: "billing.refunded",
      targetType: "Payment",
      targetId: payment.id,
      details: { amountCents: input.amountCents, gstCents: gst, method: input.method, reason: input.reason, invoiceNumber: payment.invoiceNumber },
    });
    return refund;
  });
  if (orderRefunded && payment.order) await sendOrderEmail(db, payment.order.id, "refunded").catch(() => undefined);
  return refund;
}
