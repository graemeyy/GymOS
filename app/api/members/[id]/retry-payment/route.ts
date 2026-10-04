import { staffRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { getStripe } from "@/lib/billing/stripe";
import { logAction } from "@/lib/audit";

// Asks Stripe to try the failed invoice again now (Stripe also retries on its
// own schedule). The webhook records the result.
export const POST = staffRoute({ permission: "billing:manage" }, async ({ params, db, staff }) => {
  const member = await db.member.findUnique({ where: { id: params.id }, select: { lastFailedInvoiceId: true } });
  if (!member) throw new ApiError("not_found", "Member not found.");
  if (!member.lastFailedInvoiceId) throw new ApiError("conflict", "There's no failed Stripe invoice to retry.");
  try {
    const invoice = await getStripe().invoices.pay(member.lastFailedInvoiceId);
    await logAction(db, staff, { action: "billing.payment_retried", targetType: "Member", targetId: params.id, details: { invoiceId: invoice.id, status: invoice.status } });
    return json({ status: invoice.status, paid: invoice.status === "paid" });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const code = (error as { code?: string; type?: string }).code;
    const type = (error as { type?: string }).type;
    await logAction(db, staff, { action: "billing.payment_retry_failed", targetType: "Member", targetId: params.id, details: { code: code ?? type ?? "unknown" } });
    // Say what actually happened, not "declined" for every failure (R-71).
    if (code === "invoice_already_paid" || code === "invoice_not_open") {
      throw new ApiError("conflict", "That invoice has already been paid or closed. Reload to see the member's current status.");
    }
    if (type === "StripeCardError") throw new ApiError("upstream_failed", "The card was declined again. Ask the member to update their card.");
    throw new ApiError("upstream_failed", "Stripe couldn't retry the payment just now. Try again shortly.");
  }
});
