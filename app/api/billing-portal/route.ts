import { memberRoute, json } from "@/lib/http/route";
import { openBillingPortal } from "@/lib/billing/payments";

// A member opens the Stripe customer portal for their own account only, to
// update their card or download invoices.
export const POST = memberRoute({}, async ({ db, member }) => json({ url: await openBillingPortal(db, member.id) }));
