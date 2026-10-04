import { memberRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { getTaxInvoiceForMember } from "@/lib/billing/queries";

// A member's own tax invoice. Someone else's payment ID answers "not found",
// the same as one that doesn't exist.
export const GET = memberRoute({}, async ({ params, db, member }) => {
  const invoice = await getTaxInvoiceForMember(db, member.id, params.id);
  if (!invoice) throw new ApiError("not_found", "Invoice not found.");
  return json(invoice);
});
