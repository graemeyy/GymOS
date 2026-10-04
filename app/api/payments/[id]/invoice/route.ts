import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { buildTaxInvoice } from "@/lib/billing/invoice";
import { invoiceLinesForPayment } from "@/lib/billing/invoice-lines";

export const GET = staffRoute({ permission: "revenue:view" }, async ({ params, db }) => {
  const payment = await db.payment.findUnique({ where: { id: params.id }, include: { member: { select: { name: true, email: true } } } });
  if (!payment) throw new ApiError("not_found", "Payment not found.");
  return json(buildTaxInvoice({ ...payment, lines: await invoiceLinesForPayment(db, payment) }));
});
