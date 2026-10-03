import { memberRoute, json } from "@/lib/http/route";
import { benefitsForSlug } from "@/lib/plans";

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
      stripeCustomerId: true,
      membershipPlan: { select: { id: true, slug: true, name: true, priceCents: true, interval: true } },
    },
  });
  const { stripeCustomerId, ...rest } = me;
  return json({ ...rest, hasCardOnFile: Boolean(stripeCustomerId), benefits: benefitsForSlug(me.membershipPlan?.slug) });
});
