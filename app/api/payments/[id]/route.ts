import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";

export const GET = staffRoute({ permission: "revenue:view" }, async ({ params, db }) => {
  const payment = await db.payment.findUnique({
    where: { id: params.id },
    include: {
      member: { select: { id: true, name: true, email: true } },
      refunds: { orderBy: { createdAt: "desc" } },
      order: { select: { id: true, number: true, status: true } },
    },
  });
  if (!payment) throw new ApiError("not_found", "Payment not found.");
  const { stripeInvoiceId, stripePaymentIntentId, ...rest } = payment;
  return json({ ...rest, viaStripe: Boolean(stripePaymentIntentId || stripeInvoiceId), refundableCents: payment.amount - payment.refundedCents, canRefundViaStripe: Boolean(stripePaymentIntentId) });
});
