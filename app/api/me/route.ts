import { memberRoute, json } from "@/lib/http/route";
import { benefitsOf } from "@/lib/plans/queries";
import { getBenefitUsage } from "@/lib/membership/benefits";
import { outstandingAcceptances } from "@/lib/legal";
import { ProfileBody } from "@/lib/members/schema";
import { getMemberProfile } from "@/lib/members/queries";
import { updateMemberProfile } from "@/lib/members/service";

// The signed-in member's own record. The member ID always comes from the
// session, never from the request.
export const GET = memberRoute({}, async ({ db, member }) => {
  const me = await getMemberProfile(db, member.id);
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

export const PATCH = memberRoute({ body: ProfileBody }, async ({ body, db, member }) => json(await updateMemberProfile(db, member, body)));
