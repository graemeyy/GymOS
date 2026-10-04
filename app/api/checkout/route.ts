import { memberRoute, json } from "@/lib/http/route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { MembershipCheckoutBody, startMembershipCheckout } from "@/lib/billing/payments";

// Members start their own subscription. Staff can't start one for someone
// else (that used to be possible for any member ID).
export const POST = memberRoute({ body: MembershipCheckoutBody, rateLimit: RATE_LIMITS.checkout }, async ({ body, db, member }) => {
  return json({ url: await startMembershipCheckout(db, member, body.planId) });
});
