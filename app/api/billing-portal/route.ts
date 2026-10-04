import { memberRoute, json } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/billing/stripe";

// A member opens the Stripe customer portal for their own account only, to
// update their card or download invoices.
export const POST = memberRoute({}, async ({ db, member }) => {
  const record = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { stripeCustomerId: true } });
  if (!record.stripeCustomerId) throw new ApiError("conflict", "There's no card on file yet.");
  const session = await getStripe().billingPortal.sessions.create({
    customer: record.stripeCustomerId,
    return_url: `${env().NEXT_PUBLIC_APP_URL}/member`,
  });
  return json({ url: session.url });
});
