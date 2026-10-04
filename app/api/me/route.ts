import { z } from "zod";
import { memberRoute, json, zName } from "@/lib/http/route";
import { benefitsOf } from "@/lib/plans/queries";
import { getBenefitUsage } from "@/lib/membership/benefits";
import { outstandingAcceptances } from "@/lib/legal";
import { logAction } from "@/lib/audit";

// The signed-in member's own record. The member ID always comes from the
// session, never from the request.
export const GET = memberRoute({}, async ({ db, member }) => {
  const me = await db.member.findUniqueOrThrow({
    where: { id: member.id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      onboardedAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      currentPeriodEnd: true,
      pausedFrom: true,
      pausedUntil: true,
      cancelAt: true,
      cancelledAt: true,
      amountOwingCents: true,
      notifyAnnouncements: true,
      notifyWaitlist: true,
      membershipPlan: { select: { id: true, slug: true, name: true, priceCents: true, interval: true, classCreditsPerCycle: true, guestPassesPerCycle: true, shopDiscountPercent: true, guestRateCents: true } },
      pendingPlan: { select: { id: true, name: true, priceCents: true, interval: true } },
    },
  });
  const [usage, outstanding] = await Promise.all([getBenefitUsage(db, member.id), outstandingAcceptances(db, member.id)]);
  const { stripeCustomerId, stripeSubscriptionId, ...rest } = me;
  return json({
    ...rest,
    hasCardOnFile: Boolean(stripeCustomerId),
    billedOnline: Boolean(stripeSubscriptionId),
    benefits: benefitsOf(me.membershipPlan),
    usage: { classCreditsRemaining: usage.classCredits.remaining, guestPassesRemaining: usage.guestPasses.remaining, cycleEnd: usage.cycle?.end ?? null },
    outstandingAcceptances: outstanding,
  });
});

const Patch = z
  .object({
    name: zName.optional(),
    notifyAnnouncements: z.boolean().optional(),
    notifyWaitlist: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change" });

// Members can change their name and email preferences. Email address changes
// go through the front desk until email verification exists, so a typo can't
// lock someone out or move their account to an address they don't own.
export const PATCH = memberRoute({ body: Patch }, async ({ body, db, member }) => {
  const updated = await db.member.update({ where: { id: member.id }, data: body, select: { name: true, notifyAnnouncements: true, notifyWaitlist: true } });
  await logAction(db, member, { action: "member.profile_updated", targetType: "Member", targetId: member.id, details: { changed: Object.keys(body) } });
  return json(updated);
});
