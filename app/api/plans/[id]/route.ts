import { staffRoute, json } from "@/lib/http/route";
import { logAction } from "@/lib/audit";
import { ApiError } from "@/lib/http/errors";
import { UpdatePlanBody } from "@/lib/plans-schema";

// Price changes apply to new sign-ups and plan changes. Existing Stripe
// subscriptions keep their price until changed, and members must be given
// notice of a price rise (see docs/COMPLIANCE-NOTES.md). Plans are retired
// (active: false), never deleted, so history and reports stay intact.
export const PUT = staffRoute({ permission: "plans:manage", body: UpdatePlanBody }, async ({ params, body, db, staff }) => {
  const before = await db.membershipPlan.findUniqueOrThrow({ where: { id: params.id } });
  const priceChanged = body.priceCents !== undefined && body.priceCents !== before.priceCents;
  const intervalChanged = body.interval !== undefined && body.interval !== before.interval;
  // Members' Stripe subscriptions keep the old interval, and credits and
  // billing dates would be worked out on the new one (R-38).
  if (intervalChanged && (await db.member.count({ where: { OR: [{ planId: params.id }, { pendingPlanId: params.id }], archivedAt: null } })) > 0) {
    throw new ApiError("conflict", "Members are on this plan, so its billing interval can't change. Create a new plan and move members to it.");
  }
  const plan = await db.membershipPlan.update({
    where: { id: params.id },
    data: { ...body, ...(priceChanged || intervalChanged ? { stripePriceId: null } : {}) },
  });
  await logAction(db, staff, {
    action: "plan.updated",
    targetType: "MembershipPlan",
    targetId: plan.id,
    details: { from: { name: before.name, priceCents: before.priceCents, interval: before.interval, active: before.active }, to: body },
  });
  return json(plan);
});
