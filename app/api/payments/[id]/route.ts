import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { getPayment } from "@/lib/billing/queries";

export const GET = staffRoute({ permission: "finance.view" }, async ({ params, db }) => {
  const payment = await getPayment(db, params.id);
  if (!payment) throw new ApiError("not_found", "Payment not found.");
  const { stripeInvoiceId, stripePaymentIntentId, ...rest } = payment;
  return json({ ...rest, viaStripe: Boolean(stripePaymentIntentId || stripeInvoiceId), refundableCents: payment.amount - payment.refundedCents, canRefundViaStripe: Boolean(stripePaymentIntentId) });
});
