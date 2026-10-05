import { appUrl } from "@/lib/app-url";
import { z } from "zod";
import type { Db } from "@/lib/db";
import type { MemberActor } from "@/lib/auth/session";
import { zCents, zId } from "@/lib/http/route";
import { ApiError } from "@/lib/http/errors";
import { gym } from "@/lib/config";
import { logAction } from "@/lib/audit";
import { recordAcceptance } from "@/lib/legal";
import { getStripe } from "./stripe";
import { stripeRecurring } from "./intervals";

export const PaymentListQuery = z.object({
  take: z.coerce.number().int().min(1).max(500).default(100),
  kind: z.enum(["MEMBERSHIP", "SHOP", "OTHER"]).optional(),
  status: z.enum(["succeeded", "refunded", "partially_refunded"]).optional(),
  q: z.string().trim().max(120).optional(),
});

export type PaymentListFilter = z.infer<typeof PaymentListQuery>;

export const RefundBody = z.object({
  amountCents: zCents,
  reason: z.string().trim().min(3, "Say why").max(300),
  method: z.enum(["STRIPE", "MANUAL"]),
  requestId: z.uuid().optional(),
});

export const MembershipCheckoutBody = z.object({
  planId: zId,
  acceptTerms: z.literal(true, { error: "Please accept the membership terms" }),
});

// Opens a Stripe Checkout page for the member's own subscription. The terms
// acceptance and the audit entry are recorded once Stripe has the session.
export async function startMembershipCheckout(db: Db, member: MemberActor, planId: string): Promise<string> {
  const plan = await db.membershipPlan.findFirst({ where: { id: planId, active: true } });
  if (!plan) throw new ApiError("validation_failed", "That plan isn't available.", { planId: "Not available" });
  const record = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { stripeCustomerId: true, stripeSubscriptionId: true, email: true, status: true } });
  if (record.stripeSubscriptionId && record.status !== "CANCELED") {
    throw new ApiError("conflict", "You already have a membership. Change plans from your membership page.");
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    // Card only: an asynchronous method (such as direct debit) would make the
    // membership active before the money arrives (R-24).
    payment_method_types: ["card"],
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
    success_url: appUrl("/member?checkout=success"),
    cancel_url: appUrl("/member?checkout=cancelled"),
  });
  await db.$transaction(async (tx) => {
    await recordAcceptance(tx, member.id, "checkout");
    await logAction(tx, member, { action: "billing.checkout_started", targetType: "MembershipPlan", targetId: plan.id, details: { termsVersion: gym.legal.termsVersion } });
  });
  if (!session.url) throw new ApiError("upstream_failed", "Stripe didn't return a checkout link. Try again.");
  return session.url;
}

// The Stripe customer portal for the member's own account only, to update
// their card or download invoices.
export async function openBillingPortal(db: Db, memberId: string): Promise<string> {
  const record = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { stripeCustomerId: true } });
  if (!record.stripeCustomerId) throw new ApiError("conflict", "There's no card on file yet.");
  const session = await getStripe().billingPortal.sessions.create({
    customer: record.stripeCustomerId,
    return_url: appUrl("/member"),
  });
  return session.url;
}
