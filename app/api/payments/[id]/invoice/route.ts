import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { getTaxInvoice } from "@/lib/billing/queries";

export const GET = staffRoute({ permission: "revenue:view" }, async ({ params, db }) => {
  const invoice = await getTaxInvoice(db, params.id);
  if (!invoice) throw new ApiError("not_found", "Payment not found.");
  return json(invoice);
});
