import { z } from "zod";
import { memberRoute, json, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { env } from "@/lib/env";
import { gym } from "@/lib/config";
import { getStripe } from "@/lib/billing/stripe";
import { stripeRecurring } from "@/lib/billing/intervals";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { logAction } from "@/lib/audit";
import { recordAcceptance } from "@/lib/legal";

const Body = z.object({
  planId: zId,
  acceptTerms: z.literal(true, { error: "Please accept the membership terms" }),
});

// Members start their own subscription. Staff can't start one for someone
// else (that used to be possible for any member ID).
export const POST = memberRoute({ body: Body, rateLimit: RATE_LIMITS.checkout }, async ({ body, db, member }) => {
  const plan = await db.membershipPlan.findFirst({ where: { id: body.planId, active: true } });
  if (!plan) throw new ApiError("validation_failed", "That plan isn't available.", { planId: "Not available" });
  const record = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { stripeCustomerId: true, stripeSubscriptionId: true, email: true, status: true } });
  if (record.stripeSubscriptionId && record.status !== "CANCELED") {
    throw new ApiError("conflict", "You already have a membership. Change plans from your membership page.");
  }

  const appUrl = env().NEXT_PUBLIC_APP_URL;
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "aud",
          unit_amount: plan.priceCents,
          recurring: stripeRecurring(plan.interval),
          product_data: { name: `${gym.brand.name} ${plan.name} membership`, description: "Price includes GST." },
        },
        quantity: 1,
      },
    ],
    client_reference_id: member.id,
    metadata: { memberId: member.id, planId: plan.id, termsVersion: gym.legal.termsVersion },
    subscription_data: { metadata: { memberId: member.id, planId: plan.id } },
    ...(record.stripeCustomerId ? { customer: record.stripeCustomerId } : { customer_email: record.email }),
    success_url: `${appUrl}/member?checkout=success`,
    cancel_url: `${appUrl}/member?checkout=cancelled`,
  });
  await recordAcceptance(db, member.id, "checkout");
  await logAction(db, member, { action: "billing.checkout_started", targetType: "MembershipPlan", targetId: plan.id, details: { termsVersion: gym.legal.termsVersion } });
  if (!session.url) throw new ApiError("upstream_failed", "Stripe didn't return a checkout link. Try again.");
  return json({ url: session.url });
});
