import { staffRoute, json } from "@/lib/http/route";
import { RefundBody } from "@/lib/billing/payments";
import { refundPayment } from "@/lib/billing/refunds";

export const POST = staffRoute({ permission: "billing:refund", body: RefundBody }, async ({ params, body, db, staff }) => {
  return json(await refundPayment(db, staff, { paymentId: params.id, ...body }), 201);
});
