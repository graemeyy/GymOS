import { memberRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { buildTaxInvoice } from "@/lib/billing/invoice";
import { invoiceLinesForPayment } from "@/lib/billing/invoice-lines";

// A member's own tax invoice. Someone else's payment ID answers "not found",
// the same as one that doesn't exist.
export const GET = memberRoute({}, async ({ params, db, member }) => {
  const payment = await db.payment.findFirst({ where: { id: params.id, memberId: member.id }, include: { member: { select: { name: true, email: true } } } });
  if (!payment) throw new ApiError("not_found", "Invoice not found.");
  return json(buildTaxInvoice({ ...payment, lines: await invoiceLinesForPayment(db, payment) }));
});
